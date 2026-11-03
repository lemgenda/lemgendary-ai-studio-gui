// Opens the per-window frame source for the current operating system.
//
// Windows: Windows Graphics Capture of the app's own HWND.
// macOS / Linux: not supported yet (no per-window capture is wired up); the
// command returns a clear error and the UI shows it.

use tauri::{Runtime, WebviewWindow};

use super::FrameSource;

#[cfg(windows)]
pub fn open_window_source<R: Runtime>(
    window: &WebviewWindow<R>,
) -> Result<Box<dyn FrameSource>, String> {
    let hwnd = window
        .hwnd()
        .map_err(|e| format!("Could not get the application window handle: {e}"))?;
    let source = super::windows_source::WgcWindowSource::open(hwnd.0)?;
    Ok(Box::new(source))
}

#[cfg(not(windows))]
pub fn open_window_source<R: Runtime>(
    _window: &WebviewWindow<R>,
) -> Result<Box<dyn FrameSource>, String> {
    Err(format!(
        "Screen recording is not supported on this platform yet ({}); it is available on Windows",
        std::env::consts::OS
    ))
}
