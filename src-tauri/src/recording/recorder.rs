// `WindowRecorder` that drives a `RecordingSession` on a worker thread at the
// target frame rate. Commands only take the lock briefly; the 60 s limit is
// enforced both by the worker and on every status/pause/stop call.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use super::session::RecordingSession;
use super::{
    Clock, FrameSource, RecordedVideo, RecordingStatus, VideoEncoder, WindowRecorder, TARGET_FPS,
};

/// Wall-clock monotonic time.
pub struct SystemClock {
    origin: Instant,
}

impl SystemClock {
    pub fn new() -> Self {
        Self {
            origin: Instant::now(),
        }
    }
}

impl Default for SystemClock {
    fn default() -> Self {
        Self::new()
    }
}

impl Clock for SystemClock {
    fn now(&self) -> Duration {
        self.origin.elapsed()
    }
}

#[derive(Default)]
struct Shared {
    session: Mutex<Option<RecordingSession>>,
    halt: AtomicBool,
}

impl Shared {
    fn lock(&self) -> Result<MutexGuard<'_, Option<RecordingSession>>, String> {
        self.session
            .lock()
            .map_err(|_| "Recording state is unavailable after an internal panic".to_string())
    }
}

pub struct ThreadedRecorder<C: Clock + 'static> {
    clock: Arc<C>,
    shared: Arc<Shared>,
    worker: Option<JoinHandle<Result<(), String>>>,
}

impl<C: Clock + 'static> ThreadedRecorder<C> {
    pub fn new(clock: C) -> Self {
        Self {
            clock: Arc::new(clock),
            shared: Arc::new(Shared::default()),
            worker: None,
        }
    }

    fn halt_worker(&mut self) -> Result<(), String> {
        self.shared.halt.store(true, Ordering::SeqCst);
        match self.worker.take() {
            Some(handle) => handle
                .join()
                .map_err(|_| "Recording worker thread panicked".to_string())?,
            None => Ok(()),
        }
    }
}

fn run_worker<C: Clock>(clock: Arc<C>, shared: Arc<Shared>) -> Result<(), String> {
    let interval = Duration::from_secs(1) / TARGET_FPS;
    while !shared.halt.load(Ordering::SeqCst) {
        let wait = {
            let mut guard = shared.lock()?;
            let Some(session) = guard.as_mut() else {
                return Ok(());
            };
            let now = clock.now();
            session.tick(now);
            if session.is_finished() {
                return Ok(());
            }
            session.time_until_next_frame(clock.now())
        };
        thread::sleep(wait.clamp(Duration::from_millis(1), interval));
    }
    Ok(())
}

impl<C: Clock + 'static> WindowRecorder for ThreadedRecorder<C> {
    fn start(
        &mut self,
        source: Box<dyn FrameSource>,
        encoder: Box<dyn VideoEncoder>,
    ) -> Result<RecordingStatus, String> {
        let status = {
            let mut guard = self.shared.lock()?;
            if guard.is_some() {
                // Close the new source; the running recording keeps its own.
                source.close()?;
                return Err(
                    "A recording is already in progress; stop it before starting another"
                        .to_string(),
                );
            }
            let now = self.clock.now();
            let mut session = RecordingSession::start(source, encoder, now);
            let status = session.status(now);
            *guard = Some(session);
            status
        };
        self.halt_worker()?;
        self.shared.halt.store(false, Ordering::SeqCst);
        let clock = self.clock.clone();
        let shared = self.shared.clone();
        self.worker = Some(
            thread::Builder::new()
                .name("window-recorder".to_string())
                .spawn(move || run_worker(clock, shared))
                .map_err(|e| format!("Could not start the recording thread: {e}"))?,
        );
        Ok(status)
    }

    fn pause(&mut self) -> Result<RecordingStatus, String> {
        let mut guard = self.shared.lock()?;
        let session = guard.as_mut().ok_or_else(no_recording)?;
        session.pause(self.clock.now())
    }

    fn resume(&mut self) -> Result<RecordingStatus, String> {
        let mut guard = self.shared.lock()?;
        let session = guard.as_mut().ok_or_else(no_recording)?;
        session.resume(self.clock.now())
    }

    fn stop(&mut self) -> Result<RecordedVideo, String> {
        let worker_result = self.halt_worker();
        let session = self.shared.lock()?.take().ok_or_else(no_recording)?;
        let recorded = session.stop(self.clock.now());
        worker_result?;
        recorded
    }

    fn status(&self) -> Result<RecordingStatus, String> {
        let mut guard = self.shared.lock()?;
        Ok(match guard.as_mut() {
            Some(session) => session.status(self.clock.now()),
            None => RecordingStatus::idle(),
        })
    }
}

fn no_recording() -> String {
    "No recording is in progress".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::recording::session::tests::fakes;
    use crate::recording::RecordingState;

    /// Manually advanced clock.
    #[derive(Clone, Default)]
    struct FakeClock(Arc<Mutex<Duration>>);

    impl FakeClock {
        fn set(&self, secs: u64) {
            *self.0.lock().expect("clock") = Duration::from_secs(secs);
        }
    }

    impl Clock for FakeClock {
        fn now(&self) -> Duration {
            *self.0.lock().expect("clock")
        }
    }

    /// Waits (real time) until the worker has captured the first frame.
    fn wait_for_first_frame<C: Clock + 'static>(recorder: &ThreadedRecorder<C>) {
        let deadline = Instant::now() + Duration::from_secs(5);
        while recorder.status().expect("status").frames == 0 && Instant::now() < deadline {
            thread::sleep(Duration::from_millis(5));
        }
    }

    #[test]
    fn full_cycle_with_fake_clock() {
        let clock = FakeClock::default();
        let mut recorder = ThreadedRecorder::new(clock.clone());
        let (source, encoder, log) = fakes(false);
        let started = recorder.start(source, encoder).expect("start");
        assert_eq!(started.state, RecordingState::Recording);
        wait_for_first_frame(&recorder);
        clock.set(10);
        assert_eq!(recorder.pause().expect("pause").elapsed_ms, 10_000);
        clock.set(40);
        assert_eq!(recorder.resume().expect("resume").elapsed_ms, 10_000);
        clock.set(45);
        let video = recorder.stop().expect("stop");
        assert_eq!(video.duration, Duration::from_secs(15));
        assert!(video.frames >= 1);
        assert_eq!(log.lock().expect("log").closed, 1);
        assert_eq!(
            recorder.status().expect("status").state,
            RecordingState::Idle
        );
    }

    #[test]
    fn double_start_is_rejected() {
        let mut recorder = ThreadedRecorder::new(FakeClock::default());
        let (source, encoder, _log) = fakes(false);
        recorder.start(source, encoder).expect("first start");
        let (second_source, second_encoder, second_log) = fakes(false);
        let error = recorder
            .start(second_source, second_encoder)
            .expect_err("second start must fail");
        assert!(error.contains("already in progress"));
        assert_eq!(second_log.lock().expect("log").closed, 1);
        wait_for_first_frame(&recorder);
        recorder.stop().expect("stop");
    }

    #[test]
    fn auto_stops_at_limit_via_injected_clock() {
        let clock = FakeClock::default();
        let mut recorder = ThreadedRecorder::new(clock.clone());
        let (source, encoder, log) = fakes(false);
        recorder.start(source, encoder).expect("start");
        wait_for_first_frame(&recorder);
        clock.set(61);
        let status = recorder.status().expect("status");
        assert_eq!(status.state, RecordingState::LimitReached);
        assert_eq!(status.elapsed_ms, 60_000);
        assert_eq!(log.lock().expect("log").closed, 1);
        let video = recorder.stop().expect("stop");
        assert_eq!(video.duration, Duration::from_secs(60));
    }

    #[test]
    fn commands_without_recording_fail_clearly() {
        let mut recorder = ThreadedRecorder::new(FakeClock::default());
        assert_eq!(recorder.pause(), Err(no_recording()));
        assert_eq!(recorder.stop(), Err(no_recording()));
    }
}
