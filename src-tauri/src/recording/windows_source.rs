// Windows frame source: Windows Graphics Capture of ONE window (by HWND).
//
// WGC captures the window's own composition surface, so overlapping windows
// and the desktop never appear in the frames. No picker is shown; the item is
// created from the app's own HWND. Windows draws its capture border around
// the window while recording (visible indicator).

use std::ffi::c_void;
use std::sync::{Arc, Mutex};

use windows_capture::capture::{CaptureControl, Context, GraphicsCaptureApiHandler};
use windows_capture::frame::Frame as WgcFrame;
use windows_capture::graphics_capture_api::InternalCaptureControl;
use windows_capture::settings::{
    ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings,
    MinimumUpdateIntervalSettings, SecondaryWindowSettings, Settings,
};
use windows_capture::window::Window;

use super::{Frame, FrameSource};

type Slot = Arc<Mutex<Option<Arc<Frame>>>>;

fn lock_error() -> String {
    "Captured frame buffer is unavailable after an internal panic".to_string()
}

/// Called by windows-capture on its capture thread for every new frame.
pub struct LatestFrameHandler {
    slot: Slot,
    scratch: Vec<u8>,
}

impl GraphicsCaptureApiHandler for LatestFrameHandler {
    type Flags = Slot;
    type Error = String;

    fn new(ctx: Context<Self::Flags>) -> Result<Self, Self::Error> {
        Ok(Self {
            slot: ctx.flags,
            scratch: Vec::new(),
        })
    }

    fn on_frame_arrived(
        &mut self,
        frame: &mut WgcFrame,
        _capture_control: InternalCaptureControl,
    ) -> Result<(), Self::Error> {
        let buffer = frame
            .buffer()
            .map_err(|e| format!("Could not read the captured frame: {e}"))?;
        let (width, height) = (buffer.width(), buffer.height());
        let pixels = buffer.as_nopadding_buffer(&mut self.scratch).to_vec();
        let captured = Frame::new(width, height, pixels)?;
        *self.slot.lock().map_err(|_| lock_error())? = Some(Arc::new(captured));
        Ok(())
    }
}

pub struct WgcWindowSource {
    control: CaptureControl<LatestFrameHandler, String>,
    slot: Slot,
}

impl WgcWindowSource {
    /// Starts capturing the window `hwnd` (must be the app's own window).
    pub fn open(hwnd: *mut c_void) -> Result<Self, String> {
        let window = Window::from_raw_hwnd(hwnd);
        if !window.is_valid() {
            return Err("The application window cannot be captured (not a valid window)".to_string());
        }
        let slot: Slot = Arc::new(Mutex::new(None));
        let settings = Settings::new(
            window,
            CursorCaptureSettings::Default,
            DrawBorderSettings::Default,
            SecondaryWindowSettings::Default,
            MinimumUpdateIntervalSettings::Default,
            DirtyRegionSettings::Default,
            ColorFormat::Bgra8,
            slot.clone(),
        );
        let control = LatestFrameHandler::start_free_threaded(settings)
            .map_err(|e| format!("Could not start window capture: {e}"))?;
        Ok(Self { control, slot })
    }
}

impl FrameSource for WgcWindowSource {
    fn latest(&mut self) -> Result<Option<Arc<Frame>>, String> {
        if self.control.is_finished() {
            return Err("Window capture stopped (the window was closed or capture failed)".to_string());
        }
        Ok(self.slot.lock().map_err(|_| lock_error())?.clone())
    }

    fn close(self: Box<Self>) -> Result<(), String> {
        self.control
            .stop()
            .map_err(|e| format!("Could not stop window capture: {e}"))
    }
}
