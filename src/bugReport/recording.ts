import { invoke, isTauri } from "@tauri-apps/api/core";
import { RECORDING_TYPES } from "./limits";

/**
 * App-window screen recording: the contract with the desktop app's native
 * `recording_*` commands (src-tauri/src/recording/commands.rs).
 */

/** `RecordingState` in the Rust recorder (serialised snake_case). */
export type NativeRecordingState = "idle" | "recording" | "paused" | "limit_reached" | "failed";

/** `RecordingStatus` returned by `recording_status`, `recording_pause` and `recording_resume`. */
export interface NativeRecordingStatus {
  state: NativeRecordingState;
  elapsedMs: number;
  maxMs: number;
  frames: number;
  error: string | null;
}

/** A finished clip, ready to attach as the `recording` part of the bug report. */
export interface RecordedClip {
  blob: Blob;
  durationMs: number;
  frames: number;
  fps: number;
  width: number;
  height: number;
}

/** The native recorder, abstracted so the controller can be tested without Tauri. */
export interface RecorderBackend {
  start(): Promise<NativeRecordingStatus>;
  pause(): Promise<NativeRecordingStatus>;
  resume(): Promise<NativeRecordingStatus>;
  /** Ends the recording and returns the packed reply of `recording_stop`. */
  stop(): Promise<ArrayBuffer>;
  status(): Promise<NativeRecordingStatus>;
}

interface PackedHeader {
  mime: string;
  durationMs: number;
  frames: number;
  fps: number;
  width: number;
  height: number;
}

const HEADER_NUMBERS = ["durationMs", "frames", "fps", "width", "height"] as const;

function parseHeader(text: string): PackedHeader {
  const value: unknown = JSON.parse(text);
  if (typeof value !== "object" || value === null) {
    throw new Error("Recording header is not a JSON object");
  }
  const record = value as Record<string, unknown>;
  const mime = record.mime;
  if (typeof mime !== "string" || !RECORDING_TYPES.includes(mime)) {
    throw new Error(`Recording has an unsupported type: ${String(mime)}`);
  }
  for (const key of HEADER_NUMBERS) {
    if (typeof record[key] !== "number" || !Number.isFinite(record[key])) {
      throw new Error(`Recording header field "${key}" is not a number`);
    }
  }
  return record as unknown as PackedHeader;
}

/**
 * Splits the `recording_stop` reply: `[u32 LE header length][JSON header][video bytes]`.
 */
export function unpackRecording(packed: ArrayBuffer): RecordedClip {
  if (packed.byteLength < 4) {
    throw new Error("Recording reply is too short");
  }
  const headerLength = new DataView(packed).getUint32(0, true);
  const videoStart = 4 + headerLength;
  if (videoStart > packed.byteLength) {
    throw new Error("Recording reply header is truncated");
  }
  const header = parseHeader(new TextDecoder().decode(new Uint8Array(packed, 4, headerLength)));
  if (videoStart === packed.byteLength) {
    throw new Error("Recording reply contains no video");
  }
  return {
    blob: new Blob([packed.slice(videoStart)], { type: header.mime }),
    durationMs: header.durationMs,
    frames: header.frames,
    fps: header.fps,
    width: header.width,
    height: header.height,
  };
}

/** `m:ss` for a recording timer. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** File size with one decimal (KB below 1 MB). */
export function formatFileSize(bytes: number): string {
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KB`;
  return `${(kib / 1024).toFixed(1)} MB`;
}

/** Native recording exists only inside the desktop app. */
export function isRecordingAvailable(): boolean {
  return isTauri();
}

/** The desktop app's native recorder. */
export const tauriRecorderBackend: RecorderBackend = {
  start: () => invoke<NativeRecordingStatus>("recording_start"),
  pause: () => invoke<NativeRecordingStatus>("recording_pause"),
  resume: () => invoke<NativeRecordingStatus>("recording_resume"),
  stop: () => invoke<ArrayBuffer>("recording_stop"),
  status: () => invoke<NativeRecordingStatus>("recording_status"),
};
