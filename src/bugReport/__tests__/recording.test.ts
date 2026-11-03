import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NativeRecordingState,
  NativeRecordingStatus,
  RecordedClip,
  RecorderBackend,
  formatClock,
  formatFileSize,
  unpackRecording,
} from "../recording";
import { packRecording } from "./packRecording";
import { PollScheduler, RecordingController, recorderErrorMessage } from "../recordingController";

const HEADER = { mime: "video/mp4", durationMs: 3200, frames: 77, fps: 24.1, width: 730, height: 480 };

describe("unpackRecording", () => {
  it("splits the header from the MP4 bytes", async () => {
    const clip = unpackRecording(packRecording(HEADER, new Uint8Array([0, 0, 0, 8, 102, 116, 121, 112])));
    expect(clip.blob.type).toBe("video/mp4");
    expect(clip.blob.size).toBe(8);
    expect(Array.from(new Uint8Array(await clip.blob.arrayBuffer()))).toEqual([0, 0, 0, 8, 102, 116, 121, 112]);
    expect(clip).toMatchObject({ durationMs: 3200, frames: 77, fps: 24.1, width: 730, height: 480 });
  });

  it("rejects malformed replies", () => {
    expect(() => unpackRecording(new ArrayBuffer(2))).toThrow(/too short/);
    const truncated = new Uint8Array(8);
    new DataView(truncated.buffer).setUint32(0, 100, true);
    expect(() => unpackRecording(truncated.buffer)).toThrow(/truncated/);
    expect(() => unpackRecording(packRecording(HEADER, new Uint8Array()))).toThrow(/no video/);
    expect(() => unpackRecording(packRecording({ ...HEADER, mime: "video/avi" }, new Uint8Array([1])))).toThrow(
      /unsupported type/
    );
    expect(() => unpackRecording(packRecording({ ...HEADER, frames: "many" }, new Uint8Array([1])))).toThrow(/frames/);
  });
});

describe("formatting", () => {
  it("formats the timer and the file size", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(9_999)).toBe("0:09");
    expect(formatClock(60_000)).toBe("1:00");
    expect(formatFileSize(512)).toBe("0.5 KB");
    expect(formatFileSize(3 * 1024 * 1024 + 300 * 1024)).toBe("3.3 MB");
  });

  it("reads Tauri string rejections and Errors", () => {
    expect(recorderErrorMessage("window closed")).toBe("window closed");
    expect(recorderErrorMessage(new Error("boom"))).toBe("boom");
  });
});

/** Scriptable native recorder. */
class FakeBackend implements RecorderBackend {
  state: NativeRecordingState = "idle";
  elapsedMs = 0;
  error: string | null = null;
  stopReply: () => Promise<ArrayBuffer> = async () => packRecording(HEADER, new Uint8Array([1, 2, 3]));
  readonly calls: string[] = [];

  private snapshot(): NativeRecordingStatus {
    return { state: this.state, elapsedMs: this.elapsedMs, maxMs: 60_000, frames: 1, error: this.error };
  }
  async start() {
    this.calls.push("start");
    this.state = "recording";
    return this.snapshot();
  }
  async pause() {
    this.calls.push("pause");
    this.state = "paused";
    return this.snapshot();
  }
  async resume() {
    this.calls.push("resume");
    this.state = "recording";
    return this.snapshot();
  }
  async stop() {
    this.calls.push("stop");
    this.state = "idle";
    return this.stopReply();
  }
  async status() {
    this.calls.push("status");
    return this.snapshot();
  }
}

/** Manually fired interval. */
class FakeScheduler implements PollScheduler {
  callback: (() => void) | null = null;
  setInterval(callback: () => void): number {
    this.callback = callback;
    return 1;
  }
  clearInterval(): void {
    this.callback = null;
  }
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

describe("RecordingController", () => {
  let backend: FakeBackend;
  let scheduler: FakeScheduler;
  let finished: RecordedClip[];
  let controller: RecordingController;

  beforeEach(() => {
    backend = new FakeBackend();
    scheduler = new FakeScheduler();
    finished = [];
    controller = new RecordingController(backend, (clip) => finished.push(clip), scheduler, 250);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const tick = async (elapsedMs: number) => {
    backend.elapsedMs = elapsedMs;
    scheduler.callback?.();
    await settle();
  };

  it("starts, pauses, continues and stops with the clip", async () => {
    await controller.start();
    expect(controller.getView().phase).toBe("recording");
    await tick(1500);
    expect(controller.getView().elapsedMs).toBe(1500);
    await controller.pause();
    expect(controller.getView().phase).toBe("paused");
    await controller.resume();
    expect(controller.getView().phase).toBe("recording");
    await controller.stop();
    expect(controller.getView()).toMatchObject({ phase: "idle", elapsedMs: 3200, error: null });
    expect(finished).toHaveLength(1);
    expect(finished[0].blob.type).toBe("video/mp4");
    expect(scheduler.callback).toBeNull();
    expect(backend.calls).toEqual(["start", "status", "pause", "resume", "stop"]);
  });

  it("stops automatically when the native 60 s limit is reached", async () => {
    await controller.start();
    backend.state = "limit_reached";
    await tick(60_000);
    expect(backend.calls).toContain("stop");
    expect(controller.getView().phase).toBe("idle");
    expect(finished).toHaveLength(1);
  });

  it("reports a capture failure from stop and ends idle", async () => {
    await controller.start();
    backend.state = "failed";
    backend.stopReply = () => Promise.reject("Window capture stopped");
    await tick(800);
    expect(controller.getView()).toMatchObject({
      phase: "idle",
      error: "The recording could not be finished: Window capture stopped",
    });
    expect(finished).toHaveLength(0);
  });

  it("shows a start failure", async () => {
    backend.start = () => Promise.reject("Screen recording is not supported on this platform yet (linux)");
    await controller.start();
    expect(controller.getView().phase).toBe("idle");
    expect(controller.getView().error).toMatch(/^Could not start the recording: .*linux/);
    expect(scheduler.callback).toBeNull();
    controller.clearError();
    expect(controller.getView().error).toBeNull();
  });

  it("discards an unfinished recording on dispose without delivering it", async () => {
    await controller.start();
    await controller.dispose();
    expect(backend.calls).toContain("stop");
    expect(finished).toHaveLength(0);
    expect(scheduler.callback).toBeNull();
  });

  it("notifies subscribers and ignores actions in the wrong phase", async () => {
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    await controller.pause();
    await controller.stop();
    expect(backend.calls).toEqual([]);
    await controller.start();
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    await controller.pause();
    expect(listener).not.toHaveBeenCalled();
  });
});
