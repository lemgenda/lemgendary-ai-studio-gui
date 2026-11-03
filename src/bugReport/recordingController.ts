import { NativeRecordingStatus, RecordedClip, RecorderBackend, unpackRecording } from "./recording";
import { logger } from "../utils/logger";

/** What the recording UI shows. */
export type RecorderPhase = "idle" | "starting" | "recording" | "paused" | "stopping";

export interface RecorderView {
  phase: RecorderPhase;
  elapsedMs: number;
  maxMs: number;
  /** Last failure, shown until the next start. */
  error: string | null;
}

/** Timer functions, injectable for tests. */
export interface PollScheduler {
  setInterval(callback: () => void, ms: number): number;
  clearInterval(handle: number): void;
}

export const DEFAULT_POLL_MS = 250;
/** Shown before the first status arrives; the native limit replaces it. */
const DEFAULT_MAX_MS = 60_000;

const browserScheduler: PollScheduler = {
  setInterval: (callback, ms) => window.setInterval(callback, ms),
  clearInterval: (handle) => window.clearInterval(handle),
};

/** Tauri rejects with the command's error string; anything else is an Error. */
export function recorderErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return String(err);
}

const ACTIVE: readonly RecorderPhase[] = ["recording", "paused"];

/**
 * Drives the native recorder: start / pause / continue / stop, polls the
 * elapsed time, and stops automatically when the native 60 s limit is reached
 * or capture fails. A finished clip is handed to `onFinished`.
 */
export class RecordingController {
  private view: RecorderView = { phase: "idle", elapsedMs: 0, maxMs: DEFAULT_MAX_MS, error: null };
  private readonly listeners = new Set<() => void>();
  private pollHandle: number | null = null;
  private polling = false;
  private disposed = false;

  constructor(
    private readonly backend: RecorderBackend,
    private readonly onFinished: (clip: RecordedClip) => void,
    private readonly scheduler: PollScheduler = browserScheduler,
    private readonly pollMs: number = DEFAULT_POLL_MS
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getView = (): RecorderView => this.view;

  async start(): Promise<void> {
    if (this.view.phase !== "idle") return;
    this.setView({ phase: "starting", elapsedMs: 0, error: null });
    try {
      const status = await this.backend.start();
      this.applyStatus(status);
      this.startPolling();
    } catch (err: unknown) {
      this.fail("Could not start the recording", err);
    }
  }

  async pause(): Promise<void> {
    if (this.view.phase !== "recording") return;
    await this.transition(() => this.backend.pause(), "Could not pause the recording");
  }

  async resume(): Promise<void> {
    if (this.view.phase !== "paused") return;
    await this.transition(() => this.backend.resume(), "Could not continue the recording");
  }

  /** Ends the recording; the clip goes to `onFinished`. */
  async stop(): Promise<void> {
    if (!ACTIVE.includes(this.view.phase)) return;
    this.stopPolling();
    this.setView({ phase: "stopping" });
    try {
      const clip = unpackRecording(await this.backend.stop());
      this.setView({ phase: "idle", elapsedMs: clip.durationMs });
      if (!this.disposed) this.onFinished(clip);
    } catch (err: unknown) {
      this.fail("The recording could not be finished", err);
    }
  }

  /** Forgets the last failure (the dialog was closed). */
  clearError(): void {
    if (this.view.error !== null) this.setView({ error: null });
  }

  /** (Re)enables delivery of finished clips; React may dispose and reuse a controller. */
  activate(): void {
    this.disposed = false;
  }

  /** Stops polling; an active recording is stopped and discarded. */
  async dispose(): Promise<void> {
    this.disposed = true;
    this.stopPolling();
    if (ACTIVE.includes(this.view.phase)) await this.discardNative();
  }

  /** Ends the native recording without keeping the clip, so a new one can start. */
  private async discardNative(): Promise<void> {
    try {
      await this.backend.stop();
    } catch (err: unknown) {
      logger.error("Discarding the unfinished recording failed", err);
    }
  }

  private async transition(call: () => Promise<NativeRecordingStatus>, action: string): Promise<void> {
    try {
      this.applyStatus(await call());
    } catch (err: unknown) {
      // The native recorder may have hit its limit or failed meanwhile; poll decides.
      logger.error(action, err);
      this.setView({ error: `${action}: ${recorderErrorMessage(err)}` });
      await this.poll();
    }
  }

  private applyStatus(status: NativeRecordingStatus): void {
    const base = { elapsedMs: status.elapsedMs, maxMs: status.maxMs };
    switch (status.state) {
      case "recording":
        this.setView({ ...base, phase: "recording" });
        return;
      case "paused":
        this.setView({ ...base, phase: "paused" });
        return;
      case "limit_reached":
      case "failed":
        // Both end capture; `stop` returns the clip or the native error.
        this.setView(base);
        void this.stop();
        return;
      case "idle":
        this.stopPolling();
        this.setView({ ...base, phase: "idle", error: "The recording ended unexpectedly." });
        return;
    }
  }

  private startPolling(): void {
    if (this.pollHandle !== null || !ACTIVE.includes(this.view.phase)) return;
    this.pollHandle = this.scheduler.setInterval(() => void this.poll(), this.pollMs);
  }

  private stopPolling(): void {
    if (this.pollHandle === null) return;
    this.scheduler.clearInterval(this.pollHandle);
    this.pollHandle = null;
  }

  private async poll(): Promise<void> {
    if (this.polling || !ACTIVE.includes(this.view.phase)) return;
    this.polling = true;
    try {
      this.applyStatus(await this.backend.status());
    } catch (err: unknown) {
      this.fail("Could not read the recording status", err);
      await this.discardNative();
    } finally {
      this.polling = false;
    }
  }

  private fail(action: string, err: unknown): void {
    logger.error(action, err);
    this.stopPolling();
    this.setView({ phase: "idle", error: `${action}: ${recorderErrorMessage(err)}` });
  }

  private setView(patch: Partial<RecorderView>): void {
    this.view = { ...this.view, ...patch };
    this.listeners.forEach((listener) => listener());
  }
}
