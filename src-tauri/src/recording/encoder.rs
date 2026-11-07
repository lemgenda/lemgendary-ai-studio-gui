// H.264 (openh264, bundled source build) in an MP4 container (mp4 crate).
// Samples are kept in memory (<= 60 s at ~1 Mbit/s) and muxed on `finish`.

use std::io::Cursor;
use std::time::Duration;

use bytes::Bytes;
use mp4::{
    AvcConfig, FourCC, MediaConfig, Mp4Config, Mp4Sample, Mp4Writer, TrackConfig, TrackType,
};
use openh264::encoder::{
    BitRate, Encoder, EncoderConfig, FrameRate, IntraFramePeriod, RateControlMode, UsageType,
};
use openh264::formats::{BgraSliceU8, YUVBuffer};
use openh264::OpenH264API;

use super::scale::{fit_dimensions, scale_to_canvas};
use super::{EncodedVideo, Frame, VideoEncoder, MAX_HEIGHT, MAX_WIDTH, TARGET_FPS};

/// MP4 media timescale (ticks per second).
const TIMESCALE: u32 = 90_000;
const BITRATE_BPS: u32 = 1_000_000;
const NAL_SPS: u8 = 7;
const NAL_PPS: u8 = 8;
const NAL_IDR: u8 = 5;
const NAL_AUD: u8 = 9;
const NAL_SEI: u8 = 6;

struct Sample {
    at: Duration,
    is_sync: bool,
    /// Length-prefixed (AVCC) NAL units.
    data: Vec<u8>,
}

pub struct H264Mp4Encoder {
    encoder: Option<Encoder>,
    size: Option<(u32, u32)>,
    sps: Option<Vec<u8>>,
    pps: Option<Vec<u8>>,
    samples: Vec<Sample>,
}

impl H264Mp4Encoder {
    pub fn new() -> Self {
        Self {
            encoder: None,
            size: None,
            sps: None,
            pps: None,
            samples: Vec::new(),
        }
    }

    fn make_encoder() -> Result<Encoder, String> {
        let config = EncoderConfig::new()
            .usage_type(UsageType::ScreenContentRealTime)
            .rate_control_mode(RateControlMode::Bitrate)
            .bitrate(BitRate::from_bps(BITRATE_BPS))
            .max_frame_rate(FrameRate::from_hz(TARGET_FPS as f32))
            // Bitrate control needs frame skipping; a skipped frame yields no
            // NAL units and the previous sample is simply shown longer.
            .skip_frames(true)
            // Not supported for screen content; openh264 warns if requested.
            .adaptive_quantization(false)
            .background_detection(false)
            // A key frame every 2 s keeps seeking responsive.
            .intra_frame_period(IntraFramePeriod::from_num_frames(TARGET_FPS * 2));
        Encoder::with_api_config(OpenH264API::from_source(), config)
            .map_err(|e| format!("Could not start the H.264 encoder: {e}"))
    }
}

impl Default for H264Mp4Encoder {
    fn default() -> Self {
        Self::new()
    }
}

impl VideoEncoder for H264Mp4Encoder {
    fn push(&mut self, frame: &Frame, at: Duration) -> Result<(), String> {
        let (out_w, out_h) = match self.size {
            Some(size) => size,
            None => {
                let size = fit_dimensions(frame.width, frame.height, MAX_WIDTH, MAX_HEIGHT);
                self.size = Some(size);
                size
            }
        };
        let encoder = match self.encoder.as_mut() {
            Some(encoder) => encoder,
            None => self.encoder.insert(Self::make_encoder()?),
        };
        let canvas = scale_to_canvas(frame, out_w, out_h);
        let yuv =
            YUVBuffer::from_rgb_source(BgraSliceU8::new(&canvas, (out_w as usize, out_h as usize)));
        let stream = encoder
            .encode(&yuv)
            .map_err(|e| format!("H.264 encoding failed: {e}"))?;
        let mut data = Vec::new();
        let mut is_sync = false;
        for layer_index in 0..stream.num_layers() {
            let Some(layer) = stream.layer(layer_index) else {
                continue;
            };
            for nal_index in 0..layer.nal_count() {
                let Some(raw) = layer.nal_unit(nal_index) else {
                    continue;
                };
                let nal = strip_start_code(raw);
                let Some(&header) = nal.first() else {
                    continue;
                };
                match header & 0x1f {
                    NAL_SPS => {
                        self.sps.get_or_insert_with(|| nal.to_vec());
                    }
                    NAL_PPS => {
                        self.pps.get_or_insert_with(|| nal.to_vec());
                    }
                    // Not needed inside MP4 samples.
                    NAL_AUD | NAL_SEI => {}
                    nal_type => {
                        is_sync |= nal_type == NAL_IDR;
                        let length = u32::try_from(nal.len())
                            .map_err(|_| "H.264 NAL unit is too large".to_string())?;
                        data.extend_from_slice(&length.to_be_bytes());
                        data.extend_from_slice(nal);
                    }
                }
            }
        }
        if !data.is_empty() {
            self.samples.push(Sample { at, is_sync, data });
        }
        Ok(())
    }

    fn finish(self: Box<Self>, end: Duration) -> Result<EncodedVideo, String> {
        let (width, height) = self
            .size
            .ok_or_else(|| "No frames were encoded".to_string())?;
        let sps = self
            .sps
            .ok_or_else(|| "Encoder produced no SPS".to_string())?;
        let pps = self
            .pps
            .ok_or_else(|| "Encoder produced no PPS".to_string())?;
        mux(&self.samples, end, width, height, sps, pps).map(|bytes| EncodedVideo {
            bytes,
            mime: "video/mp4",
            width,
            height,
        })
    }
}

fn strip_start_code(nal: &[u8]) -> &[u8] {
    if let Some(rest) = nal.strip_prefix(&[0, 0, 0, 1]) {
        rest
    } else if let Some(rest) = nal.strip_prefix(&[0, 0, 1]) {
        rest
    } else {
        nal
    }
}

fn ticks(value: Duration) -> u64 {
    u64::try_from(value.as_nanos() * u128::from(TIMESCALE) / 1_000_000_000).unwrap_or(u64::MAX)
}

fn mux(
    samples: &[Sample],
    end: Duration,
    width: u32,
    height: u32,
    sps: Vec<u8>,
    pps: Vec<u8>,
) -> Result<Vec<u8>, String> {
    let first = samples
        .first()
        .ok_or_else(|| "No video samples were encoded".to_string())?;
    let mp4_err = |e: mp4::Error| format!("MP4 muxing failed: {e}");
    let brand = |code: &[u8; 4]| FourCC::from(*code);
    let config = Mp4Config {
        major_brand: brand(b"isom"),
        minor_version: 512,
        compatible_brands: vec![
            brand(b"isom"),
            brand(b"iso2"),
            brand(b"avc1"),
            brand(b"mp41"),
        ],
        timescale: TIMESCALE,
    };
    let mut writer = Mp4Writer::write_start(Cursor::new(Vec::new()), &config).map_err(mp4_err)?;
    writer
        .add_track(&TrackConfig {
            track_type: TrackType::Video,
            timescale: TIMESCALE,
            language: "und".to_string(),
            media_conf: MediaConfig::AvcConfig(AvcConfig {
                width: u16::try_from(width).map_err(|_| "Video is too wide".to_string())?,
                height: u16::try_from(height).map_err(|_| "Video is too tall".to_string())?,
                seq_param_set: sps,
                pic_param_set: pps,
            }),
        })
        .map_err(mp4_err)?;
    // The timeline starts at the first captured frame.
    let origin = ticks(first.at);
    let end_ticks = ticks(end).max(ticks(samples[samples.len() - 1].at) + 1);
    let min_duration = u64::from(TIMESCALE / TARGET_FPS);
    for (index, sample) in samples.iter().enumerate() {
        let start = ticks(sample.at);
        let next = match samples.get(index + 1) {
            Some(next) => ticks(next.at),
            None => end_ticks.max(start + min_duration),
        };
        let duration = u32::try_from(next.saturating_sub(start).max(1))
            .map_err(|_| "Video sample duration overflow".to_string())?;
        writer
            .write_sample(
                1,
                &Mp4Sample {
                    start_time: start - origin,
                    duration,
                    rendering_offset: 0,
                    is_sync: sample.is_sync,
                    bytes: Bytes::copy_from_slice(&sample.data),
                },
            )
            .map_err(mp4_err)?;
    }
    writer.write_end().map_err(mp4_err)?;
    Ok(writer.into_writer().into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gradient(width: u32, height: u32, shift: u32) -> Frame {
        let mut bgra = Vec::with_capacity((width * height * 4) as usize);
        for y in 0..height {
            for x in 0..width {
                bgra.extend_from_slice(&[
                    ((x + shift) % 256) as u8,
                    (y % 256) as u8,
                    ((x + y) % 256) as u8,
                    255,
                ]);
            }
        }
        Frame::new(width, height, bgra).expect("frame")
    }

    #[test]
    fn encodes_a_playable_mp4() {
        let mut encoder: Box<dyn VideoEncoder> = Box::new(H264Mp4Encoder::new());
        let step = Duration::from_secs(1) / TARGET_FPS;
        for i in 0..TARGET_FPS {
            encoder
                .push(&gradient(1280, 840, i * 4), step * i)
                .expect("push");
        }
        let video = encoder.finish(Duration::from_secs(1)).expect("finish");
        assert_eq!((video.width, video.height), (730, 480));
        assert_eq!(video.mime, "video/mp4");
        assert_eq!(&video.bytes[4..8], b"ftyp");

        let size = video.bytes.len() as u64;
        let reader = mp4::Mp4Reader::read_header(Cursor::new(video.bytes), size).expect("parse");
        let track = reader.tracks().get(&1).expect("video track");
        assert_eq!(track.width(), 730);
        assert_eq!(track.height(), 480);
        assert_eq!(track.sample_count(), TARGET_FPS);
        assert_eq!(reader.duration(), Duration::from_secs(1));
    }

    #[test]
    fn strips_annex_b_start_codes() {
        assert_eq!(strip_start_code(&[0, 0, 0, 1, 0x67]), &[0x67]);
        assert_eq!(strip_start_code(&[0, 0, 1, 0x68]), &[0x68]);
        assert_eq!(strip_start_code(&[0x65]), &[0x65]);
    }
}
