/** Builds a `recording_stop` reply like the Rust `pack_recording` (test helper). */
export function packRecording(header: object, video: Uint8Array): ArrayBuffer {
  const json = new TextEncoder().encode(JSON.stringify(header));
  const packed = new Uint8Array(4 + json.length + video.length);
  new DataView(packed.buffer).setUint32(0, json.length, true);
  packed.set(json, 4);
  packed.set(video, 4 + json.length);
  return packed.buffer;
}
