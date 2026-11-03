// Tauri commands for app-window recording. State lives in Tauri managed
// state behind a mutex; every error is returned as a message string.

use std::sync::{Mutex, MutexGuard};

use serde::Serialize;
use tauri::ipc::Response;
use tauri::{Runtime, State, WebviewWindow};

use super::encoder::H264Mp4Encoder;
use super::platform::open_window_source;
use super::recorder::{SystemClock, ThreadedRecorder};
use super::{duration_ms, RecordedVideo, RecordingState, RecordingStatus, WindowRecorder};

pub struct RecorderState(Mutex<Box<dyn WindowRecorder>>);

impl RecorderState {
    pub fn new() -> Self {
        Self(Mutex::new(Box::new(ThreadedRecorder::new(SystemClock::new()))))
    }

    fn lock(&self) -> Result<MutexGuard<'_, Box<dyn WindowRecorder>>, String> {
        self.0
            .lock()
            .map_err(|_| "Recorder is unavailable after an internal panic".to_string())
    }
}

impl Default for RecorderState {
    fn default() -> Self {
        Self::new()
    }
}

/// Metadata placed in front of the video bytes in the `recording_stop` reply.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RecordingHeader<'a> {
    mime: &'a str,
    duration_ms: u64,
    frames: u64,
    fps: f64,
    width: u32,
    height: u32,
}

/// Binary reply: `[u32 little-endian header length][UTF-8 JSON header][video]`.
/// Raw bytes avoid serialising megabytes of video as a JSON number array.
pub fn pack_recording(recorded: &RecordedVideo) -> Result<Vec<u8>, String> {
    let header = serde_json::to_vec(&RecordingHeader {
        mime: recorded.video.mime,
        duration_ms: duration_ms(recorded.duration),
        frames: recorded.frames,
        fps: (recorded.fps() * 10.0).round() / 10.0,
        width: recorded.video.width,
        height: recorded.video.height,
    })
    .map_err(|e| format!("Could not encode the recording header: {e}"))?;
    let header_len =
        u32::try_from(header.len()).map_err(|_| "Recording header is too large".to_string())?;
    let mut packed = Vec::with_capacity(4 + header.len() + recorded.video.bytes.len());
    packed.extend_from_slice(&header_len.to_le_bytes());
    packed.extend_from_slice(&header);
    packed.extend_from_slice(&recorded.video.bytes);
    Ok(packed)
}

#[tauri::command]
pub fn recording_start<R: Runtime>(
    window: WebviewWindow<R>,
    state: State<'_, RecorderState>,
) -> Result<RecordingStatus, String> {
    let mut recorder = state.lock()?;
    if recorder.status()?.state != RecordingState::Idle {
        return Err("A recording is already in progress; stop it before starting another".to_string());
    }
    let source = open_window_source(&window)?;
    recorder.start(source, Box::new(H264Mp4Encoder::new()))
}

#[tauri::command]
pub fn recording_pause(state: State<'_, RecorderState>) -> Result<RecordingStatus, String> {
    state.lock()?.pause()
}

#[tauri::command]
pub fn recording_resume(state: State<'_, RecorderState>) -> Result<RecordingStatus, String> {
    state.lock()?.resume()
}

#[tauri::command]
pub fn recording_stop(state: State<'_, RecorderState>) -> Result<Response, String> {
    let recorded = state.lock()?.stop()?;
    Ok(Response::new(pack_recording(&recorded)?))
}

#[tauri::command]
pub fn recording_status(state: State<'_, RecorderState>) -> Result<RecordingStatus, String> {
    state.lock()?.status()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::recording::EncodedVideo;
    use std::time::Duration;

    #[test]
    fn packs_header_then_video() {
        let recorded = RecordedVideo {
            video: EncodedVideo {
                bytes: vec![9, 8, 7],
                mime: "video/mp4",
                width: 730,
                height: 480,
            },
            duration: Duration::from_millis(2500),
            frames: 60,
        };
        let packed = pack_recording(&recorded).expect("pack");
        let len = u32::from_le_bytes([packed[0], packed[1], packed[2], packed[3]]) as usize;
        let header: serde_json::Value =
            serde_json::from_slice(&packed[4..4 + len]).expect("header json");
        assert_eq!(header["mime"], "video/mp4");
        assert_eq!(header["durationMs"], 2500);
        assert_eq!(header["fps"], 24.0);
        assert_eq!(header["width"], 730);
        assert_eq!(&packed[4 + len..], &[9, 8, 7]);
    }
}
