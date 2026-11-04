// App-window-only screen recording.
//
// The recorder captures the LemGendary AI Studio window's own content through
// a per-window capture API (never the desktop or other windows), scales it to
// fit 854x480, encodes H.264 and muxes an MP4 in memory.
//
// Layering (dependency inversion):
// - `session`  : pure state machine (start/pause/resume/stop, 60 s limit),
//                driven by an injectable `Clock`, a `FrameSource` and a
//                `VideoEncoder`.
// - `recorder` : `ThreadedRecorder`, the `WindowRecorder` used by the app;
//                runs the session on a worker thread at the target frame rate.
// - `encoder`  : `H264Mp4Encoder` (openh264 + mp4 crates).
// - `platform` : opens the per-window frame source for the current OS.
// - `commands` : Tauri commands and managed state.

pub mod commands;
pub mod encoder;
pub mod platform;
pub mod recorder;
pub mod scale;
pub mod session;

#[cfg(windows)]
mod windows_source;

use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;

/// Hard limit for one recording.
pub const MAX_DURATION: Duration = Duration::from_secs(60);
/// Target output frame rate.
pub const TARGET_FPS: u32 = 24;
/// Output frames fit inside this box (aspect ratio kept).
pub const MAX_WIDTH: u32 = 854;
pub const MAX_HEIGHT: u32 = 480;

/// One captured frame: tightly packed BGRA, `width * height * 4` bytes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Frame {
    pub width: u32,
    pub height: u32,
    pub bgra: Vec<u8>,
}

impl Frame {
    /// Validates the buffer length against the dimensions.
    pub fn new(width: u32, height: u32, bgra: Vec<u8>) -> Result<Self, String> {
        let expected = width as usize * height as usize * 4;
        if width == 0 || height == 0 {
            return Err(format!("Frame has an empty size ({width}x{height})"));
        }
        if bgra.len() != expected {
            return Err(format!(
                "Frame buffer has {} bytes; {width}x{height} BGRA needs {expected}",
                bgra.len()
            ));
        }
        Ok(Self { width, height, bgra })
    }
}

/// Monotonic time source (injectable for tests).
pub trait Clock: Send + Sync {
    /// Time since an arbitrary fixed origin.
    fn now(&self) -> Duration;
}

/// Produces the most recent frame of exactly one window.
pub trait FrameSource: Send {
    /// The latest frame, or `None` if the window has not delivered one yet.
    fn latest(&mut self) -> Result<Option<Arc<Frame>>, String>;
    /// Stops capturing and releases OS resources.
    fn close(self: Box<Self>) -> Result<(), String>;
}

/// Encodes frames at given timestamps into a playable file.
pub trait VideoEncoder: Send {
    /// Adds a frame shown from `at` (time on the recording timeline).
    fn push(&mut self, frame: &Frame, at: Duration) -> Result<(), String>;
    /// Finishes the file; `end` is the timeline end (duration of the video).
    fn finish(self: Box<Self>, end: Duration) -> Result<EncodedVideo, String>;
}

/// A finished encoded file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EncodedVideo {
    pub bytes: Vec<u8>,
    pub mime: &'static str,
    pub width: u32,
    pub height: u32,
}

/// Lifecycle states reported to the UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RecordingState {
    Idle,
    Recording,
    Paused,
    /// The 60 s limit was reached; capture has stopped, `stop` returns the file.
    LimitReached,
    /// Capture or encoding failed; `stop` returns the error and resets.
    Failed,
}

/// Snapshot returned by `recording_status` and the pause/resume commands.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingStatus {
    pub state: RecordingState,
    pub elapsed_ms: u64,
    pub max_ms: u64,
    pub frames: u64,
    pub error: Option<String>,
}

impl RecordingStatus {
    /// Status when no recording exists.
    pub fn idle() -> Self {
        Self {
            state: RecordingState::Idle,
            elapsed_ms: 0,
            max_ms: duration_ms(MAX_DURATION),
            frames: 0,
            error: None,
        }
    }
}

/// Whole milliseconds of a duration (saturating).
pub fn duration_ms(value: Duration) -> u64 {
    u64::try_from(value.as_millis()).unwrap_or(u64::MAX)
}

/// A finished recording handed to the frontend.
#[derive(Debug, Clone, PartialEq)]
pub struct RecordedVideo {
    pub video: EncodedVideo,
    pub duration: Duration,
    pub frames: u64,
}

impl RecordedVideo {
    /// Average frames per second actually captured.
    pub fn fps(&self) -> f64 {
        let secs = self.duration.as_secs_f64();
        if secs > 0.0 {
            self.frames as f64 / secs
        } else {
            0.0
        }
    }
}

/// Records one window. Implementations own their worker threads.
pub trait WindowRecorder: Send {
    fn start(
        &mut self,
        source: Box<dyn FrameSource>,
        encoder: Box<dyn VideoEncoder>,
    ) -> Result<RecordingStatus, String>;
    fn pause(&mut self) -> Result<RecordingStatus, String>;
    fn resume(&mut self) -> Result<RecordingStatus, String>;
    fn stop(&mut self) -> Result<RecordedVideo, String>;
    fn status(&self) -> Result<RecordingStatus, String>;
}
