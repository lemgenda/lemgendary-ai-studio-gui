// Recording state machine. Pure: time is passed in, capture and encoding are
// behind traits, so every transition is unit-testable without an OS window.

use std::time::Duration;

use super::{
    duration_ms, FrameSource, RecordedVideo, RecordingState, RecordingStatus, VideoEncoder,
    MAX_DURATION, TARGET_FPS,
};

pub struct RecordingSession {
    state: RecordingState,
    /// Active (unpaused) time completed before the current segment.
    accumulated: Duration,
    /// Clock time at which the current recording segment started.
    segment_start: Option<Duration>,
    /// Timeline position at which the next frame is due.
    next_frame_at: Duration,
    frame_interval: Duration,
    frames: u64,
    source: Option<Box<dyn FrameSource>>,
    encoder: Option<Box<dyn VideoEncoder>>,
    error: Option<String>,
}

impl RecordingSession {
    /// Starts recording at clock time `now`.
    pub fn start(
        source: Box<dyn FrameSource>,
        encoder: Box<dyn VideoEncoder>,
        now: Duration,
    ) -> Self {
        Self {
            state: RecordingState::Recording,
            accumulated: Duration::ZERO,
            segment_start: Some(now),
            next_frame_at: Duration::ZERO,
            frame_interval: Duration::from_secs(1) / TARGET_FPS,
            frames: 0,
            source: Some(source),
            encoder: Some(encoder),
            error: None,
        }
    }

    /// True when capture has ended (limit reached or failed).
    pub fn is_finished(&self) -> bool {
        matches!(
            self.state,
            RecordingState::LimitReached | RecordingState::Failed
        )
    }

    /// Recorded (unpaused) time, capped at the limit.
    pub fn elapsed(&self, now: Duration) -> Duration {
        let running = match self.segment_start {
            Some(start) => now.saturating_sub(start),
            None => Duration::ZERO,
        };
        (self.accumulated + running).min(MAX_DURATION)
    }

    /// Time until the next frame is due (zero when overdue).
    pub fn time_until_next_frame(&self, now: Duration) -> Duration {
        if self.state != RecordingState::Recording {
            return self.frame_interval;
        }
        self.next_frame_at.saturating_sub(self.elapsed(now))
    }

    pub fn status(&mut self, now: Duration) -> RecordingStatus {
        self.enforce_limit(now);
        RecordingStatus {
            state: self.state,
            elapsed_ms: duration_ms(self.elapsed(now)),
            max_ms: duration_ms(MAX_DURATION),
            frames: self.frames,
            error: self.error.clone(),
        }
    }

    /// Captures and encodes a frame if one is due. Failures move the session
    /// to `Failed`; the message is kept for `status` and `stop`.
    pub fn tick(&mut self, now: Duration) {
        self.enforce_limit(now);
        if self.state != RecordingState::Recording {
            return;
        }
        let at = self.elapsed(now);
        if at < self.next_frame_at {
            return;
        }
        if let Err(message) = self.capture_frame(at) {
            self.fail(message);
            return;
        }
        self.next_frame_at += self.frame_interval;
        if self.next_frame_at <= at {
            // Capture fell behind; skip missed slots instead of bursting.
            self.next_frame_at = at + self.frame_interval;
        }
    }

    pub fn pause(&mut self, now: Duration) -> Result<RecordingStatus, String> {
        self.enforce_limit(now);
        self.require(RecordingState::Recording, "pause")?;
        self.accumulated = self.elapsed(now);
        self.segment_start = None;
        self.state = RecordingState::Paused;
        Ok(self.status(now))
    }

    pub fn resume(&mut self, now: Duration) -> Result<RecordingStatus, String> {
        self.require(RecordingState::Paused, "continue")?;
        self.segment_start = Some(now);
        self.state = RecordingState::Recording;
        Ok(self.status(now))
    }

    /// Ends the recording and returns the encoded file.
    pub fn stop(mut self, now: Duration) -> Result<RecordedVideo, String> {
        self.enforce_limit(now);
        let duration = self.elapsed(now);
        self.release_source();
        if let Some(message) = self.error.take() {
            return Err(message);
        }
        if self.frames == 0 {
            return Err("No frames were captured from the application window".to_string());
        }
        let encoder = self
            .encoder
            .take()
            .ok_or_else(|| "Recording encoder is missing".to_string())?;
        let video = encoder.finish(duration)?;
        Ok(RecordedVideo {
            video,
            duration,
            frames: self.frames,
        })
    }

    fn capture_frame(&mut self, at: Duration) -> Result<(), String> {
        let source = self
            .source
            .as_mut()
            .ok_or_else(|| "Recording frame source is closed".to_string())?;
        let Some(frame) = source.latest()? else {
            return Ok(());
        };
        let encoder = self
            .encoder
            .as_mut()
            .ok_or_else(|| "Recording encoder is missing".to_string())?;
        encoder.push(&frame, at)?;
        self.frames += 1;
        Ok(())
    }

    fn enforce_limit(&mut self, now: Duration) {
        if self.state == RecordingState::Recording && self.elapsed(now) >= MAX_DURATION {
            self.accumulated = MAX_DURATION;
            self.segment_start = None;
            self.state = RecordingState::LimitReached;
            self.release_source();
        }
    }

    fn fail(&mut self, message: String) {
        self.error = Some(message);
        self.state = RecordingState::Failed;
        self.segment_start = None;
        self.release_source();
    }

    /// Stops OS capture. A close failure is kept as the session error unless
    /// an earlier error already explains the failure.
    fn release_source(&mut self) {
        if let Some(source) = self.source.take() {
            if let Err(message) = source.close() {
                let combined = match self.error.take() {
                    Some(previous) => format!("{previous}; closing capture also failed: {message}"),
                    None => format!("Closing window capture failed: {message}"),
                };
                self.error = Some(combined);
            }
        }
    }

    fn require(&self, expected: RecordingState, action: &str) -> Result<(), String> {
        if self.state == expected {
            Ok(())
        } else {
            Err(format!(
                "Cannot {action} the recording while it is {}",
                state_label(self.state)
            ))
        }
    }
}

fn state_label(state: RecordingState) -> &'static str {
    match state {
        RecordingState::Idle => "idle",
        RecordingState::Recording => "recording",
        RecordingState::Paused => "paused",
        RecordingState::LimitReached => "at the 60 second limit",
        RecordingState::Failed => "failed",
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::recording::{EncodedVideo, Frame};
    use std::sync::{Arc, Mutex};

    /// Shared log so tests can observe the fakes after they are boxed.
    #[derive(Default)]
    pub(crate) struct FakeLog {
        pub pushed_at: Vec<Duration>,
        pub closed: u32,
        pub finished_with: Option<Duration>,
    }

    pub(crate) struct FakeSource {
        pub log: Arc<Mutex<FakeLog>>,
        pub frame: Option<Arc<Frame>>,
        pub fail: bool,
    }

    impl FrameSource for FakeSource {
        fn latest(&mut self) -> Result<Option<Arc<Frame>>, String> {
            if self.fail {
                return Err("window closed".to_string());
            }
            Ok(self.frame.clone())
        }
        fn close(self: Box<Self>) -> Result<(), String> {
            self.log.lock().map_err(|e| e.to_string())?.closed += 1;
            Ok(())
        }
    }

    pub(crate) struct FakeEncoder {
        pub log: Arc<Mutex<FakeLog>>,
    }

    impl VideoEncoder for FakeEncoder {
        fn push(&mut self, _frame: &Frame, at: Duration) -> Result<(), String> {
            self.log.lock().map_err(|e| e.to_string())?.pushed_at.push(at);
            Ok(())
        }
        fn finish(self: Box<Self>, end: Duration) -> Result<EncodedVideo, String> {
            self.log.lock().map_err(|e| e.to_string())?.finished_with = Some(end);
            Ok(EncodedVideo {
                bytes: vec![1, 2, 3],
                mime: "video/mp4",
                width: 2,
                height: 2,
            })
        }
    }

    pub(crate) fn fakes(fail: bool) -> (Box<FakeSource>, Box<FakeEncoder>, Arc<Mutex<FakeLog>>) {
        let log = Arc::new(Mutex::new(FakeLog::default()));
        let frame = Some(Arc::new(Frame::new(2, 2, vec![0; 16]).expect("frame")));
        (
            Box::new(FakeSource { log: log.clone(), frame, fail }),
            Box::new(FakeEncoder { log: log.clone() }),
            log,
        )
    }

    fn secs(value: f64) -> Duration {
        Duration::from_secs_f64(value)
    }

    #[test]
    fn start_pause_resume_stop_removes_paused_time() {
        let (source, encoder, log) = fakes(false);
        let mut session = RecordingSession::start(source, encoder, secs(100.0));
        session.tick(secs(100.0));
        session.tick(secs(102.0));
        let paused = session.pause(secs(103.0)).expect("pause");
        assert_eq!(paused.state, RecordingState::Paused);
        assert_eq!(paused.elapsed_ms, 3000);
        session.tick(secs(110.0)); // paused: no frame
        let resumed = session.resume(secs(120.0)).expect("resume");
        assert_eq!(resumed.elapsed_ms, 3000);
        session.tick(secs(121.0));
        let video = session.stop(secs(122.0)).expect("stop");
        assert_eq!(video.duration, secs(5.0));
        assert_eq!(video.frames, 3);
        assert_eq!(video.video.mime, "video/mp4");
        let log = log.lock().expect("log");
        assert_eq!(log.pushed_at, vec![secs(0.0), secs(2.0), secs(4.0)]);
        assert_eq!(log.closed, 1);
        assert_eq!(log.finished_with, Some(secs(5.0)));
    }

    #[test]
    fn auto_stops_at_sixty_seconds() {
        let (source, encoder, log) = fakes(false);
        let mut session = RecordingSession::start(source, encoder, secs(0.0));
        session.tick(secs(0.0));
        session.tick(secs(59.9));
        session.tick(secs(75.0));
        let status = session.status(secs(80.0));
        assert_eq!(status.state, RecordingState::LimitReached);
        assert_eq!(status.elapsed_ms, 60_000);
        assert_eq!(log.lock().expect("log").closed, 1, "capture stops at the limit");
        assert!(session.pause(secs(81.0)).is_err());
        let video = session.stop(secs(90.0)).expect("stop");
        assert_eq!(video.duration, MAX_DURATION);
        assert_eq!(video.frames, 2);
    }

    #[test]
    fn limit_counts_only_unpaused_time() {
        let (source, encoder, _log) = fakes(false);
        let mut session = RecordingSession::start(source, encoder, secs(0.0));
        session.pause(secs(30.0)).expect("pause");
        session.resume(secs(500.0)).expect("resume");
        assert_eq!(session.status(secs(520.0)).state, RecordingState::Recording);
        assert_eq!(session.status(secs(530.0)).state, RecordingState::LimitReached);
    }

    #[test]
    fn frames_follow_the_target_rate() {
        let (source, encoder, log) = fakes(false);
        let mut session = RecordingSession::start(source, encoder, secs(0.0));
        let mut t = 0.0;
        while t < 1.0 {
            session.tick(secs(t));
            t += 0.005;
        }
        let count = log.lock().expect("log").pushed_at.len();
        assert_eq!(count, TARGET_FPS as usize);
    }

    #[test]
    fn invalid_transitions_are_rejected() {
        let (source, encoder, _log) = fakes(false);
        let mut session = RecordingSession::start(source, encoder, secs(0.0));
        assert!(session.resume(secs(1.0)).is_err());
        session.pause(secs(1.0)).expect("pause");
        assert!(session.pause(secs(2.0)).is_err());
    }

    #[test]
    fn source_failure_marks_session_failed_and_stop_reports_it() {
        let (source, encoder, log) = fakes(true);
        let mut session = RecordingSession::start(source, encoder, secs(0.0));
        session.tick(secs(0.0));
        let status = session.status(secs(0.1));
        assert_eq!(status.state, RecordingState::Failed);
        assert_eq!(status.error.as_deref(), Some("window closed"));
        assert_eq!(log.lock().expect("log").closed, 1);
        assert_eq!(session.stop(secs(1.0)), Err("window closed".to_string()));
    }

    #[test]
    fn stop_without_frames_is_an_error() {
        let (source, encoder, _log) = fakes(false);
        let session = RecordingSession::start(source, encoder, secs(0.0));
        assert!(session.stop(secs(1.0)).is_err());
    }
}
