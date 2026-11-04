// Downscaling of BGRA frames to the output size (area average, aspect kept).

use super::Frame;

/// Output size for a source size: fits inside `max_w` x `max_h`, keeps the
/// aspect ratio, never upscales, and is even in both directions (H.264 4:2:0).
pub fn fit_dimensions(src_w: u32, src_h: u32, max_w: u32, max_h: u32) -> (u32, u32) {
    let (sw, sh, mw, mh) = (
        u64::from(src_w),
        u64::from(src_h),
        u64::from(max_w),
        u64::from(max_h),
    );
    let (w, h) = if sw <= mw && sh <= mh {
        (sw, sh)
    } else if sw * mh >= sh * mw {
        // Width-limited.
        (mw, sh * mw / sw)
    } else {
        (sw * mh / sh, mh)
    };
    let even = |value: u64| (u32::try_from(value).unwrap_or(u32::MAX) & !1).max(2);
    (even(w), even(h))
}

/// Scales `frame` to fit an `out_w` x `out_h` canvas, centred, black bars on
/// the sides if the aspect ratio changed (window resized mid-recording).
pub fn scale_to_canvas(frame: &Frame, out_w: u32, out_h: u32) -> Vec<u8> {
    let mut canvas = vec![0u8; out_w as usize * out_h as usize * 4];
    for alpha in canvas.iter_mut().skip(3).step_by(4) {
        *alpha = 255;
    }
    let (fit_w, fit_h) = fit_dimensions(frame.width, frame.height, out_w, out_h);
    let off_x = ((out_w - fit_w) / 2) as usize;
    let off_y = ((out_h - fit_h) / 2) as usize;
    let x_spans = spans(frame.width, fit_w);
    let y_spans = spans(frame.height, fit_h);
    let src_stride = frame.width as usize * 4;
    let dst_stride = out_w as usize * 4;
    for (dy, &(y0, y1)) in y_spans.iter().enumerate() {
        let row = (off_y + dy) * dst_stride;
        for (dx, &(x0, x1)) in x_spans.iter().enumerate() {
            let mut sum = [0u32; 3];
            for y in y0..y1 {
                let line = &frame.bgra[y * src_stride + x0 * 4..y * src_stride + x1 * 4];
                let (pixels, _) = line.as_chunks::<4>();
                for px in pixels {
                    sum[0] += u32::from(px[0]);
                    sum[1] += u32::from(px[1]);
                    sum[2] += u32::from(px[2]);
                }
            }
            let count = ((y1 - y0) * (x1 - x0)) as u32;
            let at = row + (off_x + dx) * 4;
            for channel in 0..3 {
                canvas[at + channel] = (sum[channel] / count) as u8;
            }
        }
    }
    canvas
}

/// Source index range `[start, end)` covered by each destination index.
fn spans(src: u32, dst: u32) -> Vec<(usize, usize)> {
    (0..dst as usize)
        .map(|i| {
            let start = i * src as usize / dst as usize;
            let end = ((i + 1) * src as usize / dst as usize).max(start + 1);
            (start, end)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fits_inside_box_keeping_aspect_and_even() {
        assert_eq!(fit_dimensions(1280, 840, 854, 480), (730, 480));
        assert_eq!(fit_dimensions(1920, 1080, 854, 480), (852, 480));
        assert_eq!(fit_dimensions(1707, 960, 854, 480), (852, 480));
        assert_eq!(fit_dimensions(641, 401, 854, 480), (640, 400));
    }

    #[test]
    fn averages_pixels_and_letterboxes() {
        // 4x2 source: left half white, right half black -> 2x1 fit in 2x2 canvas.
        let mut bgra = Vec::new();
        for _ in 0..2 {
            bgra.extend_from_slice(&[255, 255, 255, 255, 255, 255, 255, 255]);
            bgra.extend_from_slice(&[0, 0, 0, 255, 0, 0, 0, 255]);
        }
        let frame = Frame::new(4, 2, bgra).expect("frame");
        let canvas = scale_to_canvas(&frame, 2, 2);
        assert_eq!(canvas.len(), 16);
        // fit_dimensions(4, 2, 2, 2) = (2, 1) -> rounded up to even height 2.
        assert_eq!(&canvas[0..4], &[255, 255, 255, 255]);
        assert_eq!(&canvas[4..8], &[0, 0, 0, 255]);
    }
}
