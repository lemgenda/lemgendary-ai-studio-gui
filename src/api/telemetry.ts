/**
 * LemGendary AI Studio - telemetry text cleanup, progress detection and roll-up.
 */

import { kaggleLogStatus } from "./kaggleLogLines";
import { PipelineEvent } from "./types";

const ANSI_CSI_REGEX = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g");

export function cleanAnsiAndControlChars(text: string): string {
  if (!text) return "";
  // If text contains carriage return(s), take the latest line segment
  if (text.includes("\r")) {
    const segments = text.split("\r").map((s) => s.trim()).filter(Boolean);
    if (segments.length > 0) {
      text = segments[segments.length - 1];
    }
  }
  // Strip ANSI escape sequences (\x1b[...] or \u001b[...])
  let cleaned = text.replace(ANSI_CSI_REGEX, "");
  // Strip leftover control characters like leading [K or cursor controls with parameter numbers (e.g. [2K, [0m)
  // Require at least one digit or semicolon so bracketed tags like [PROGRESS] or [GOVERNOR] are never truncated
  cleaned = cleaned
    .replace(/^\s*\[K\s*/, "")
    .replace(/^\[[0-9;]+[a-zA-Z]/, "")
    .replace(/^\[\?[0-9]+[a-zA-Z]/, "");
  cleaned = cleaned.trim();

  // Strip outdated ASCII progress bars; the modern GUI progress tracker renders the bar
  cleaned = cleaned
    .replace(/(\|[ █━─\-=#]+?\||\[[ █━─\-=#]+?\])/g, "")
    .replace(/^[ █━─\-=#|]+$/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned;
}

export function isProgressLine(msg: string): boolean {
  if (!msg) return false;
  // Kaggle push notices (unchanged variation, failed page sync) stay as their own lines.
  if (kaggleLogStatus(msg)) return false;
  // Package and requirement installation operations
  const hasPkgProgress =
    msg.includes("INSTALLING:") ||
    msg.includes("DOWNLOADING:") ||
    msg.includes("RESOLVING:") ||
    msg.includes("Installing requirements for") ||
    msg.includes("Running npm install for") ||
    msg.includes("Normalizing OpenCV provider") ||
    msg.startsWith("Collecting ") ||
    msg.startsWith("Requirement already satisfied:") ||
    msg.startsWith("Installing collected packages:");
  // Progress bar glyphs (e.g. 92% ──────── or ████ or |===|)
  const hasBar = /[\u2580-\u259F\u2500-\u257F━█─\-=]{3,}/.test(msg) && /\d+%/.test(msg);
  // Iteration rate indicators (e.g. 7875/8479 3.7it/s or 500/1000 [00:10<00:05, 10.2it/s] or 31.7M/3.84G)
  const hasRate = /\b\d+(?:\.\d+)?[KMGT]?\/\d+(?:\.\d+)?[KMGT]?\b\s+.*\b(it\/s|s\/it|B\/s|KB\/s|MB\/s|GB\/s|kB\/s)\b/i.test(msg);
  // Estimated completion timer pattern (e.g. 48:05<2:43 or 00:01<00:00)
  const hasEta = /\d+:\d+<\d+:\d+/.test(msg);
  // Classic tqdm formatting: 92%|████████  | 7875/8479 or |...| 92%
  const hasTqdm = (/\d+%\s*\|/.test(msg) || /\|\s*\d+/.test(msg)) && (/\d+\/\d+/.test(msg) || /it\/s|B\/s|kB\/s/i.test(msg));
  // Specific stages (Archiving, Uploading, Extraction) with percentage
  const hasStageProgress = (msg.includes("ARCHIVING:") || msg.includes("Uploading:") || msg.includes("EXTRACTING") || msg.includes("UNPACKING") || msg.includes("KAGGLE EXTRACTION") || msg.includes("EXTRACTION:") || (msg.includes("[UPLOAD]") && msg.includes("%")) || (msg.includes("[DOWNLOAD]") && msg.includes("%"))) && msg.includes("%");
  // Training and validation engine batch progression
  const hasBatch = /\[(?:VAL\s+)?BATCH\s+\d+\/\d+\]/i.test(msg);
  return hasPkgProgress || hasBar || hasRate || hasEta || hasTqdm || hasStageProgress || hasBatch;
}

/**
 * Rolls up consecutive progress ticks and batch metrics in-place, mirroring stdout carriage-return (\r) semantics.
 * Consecutive progress events (including [BATCH ...] training iterations, upload/download ticks, and tqdm frames)
 * update in a single line in the terminal output, while discrete operational milestones, errors, warnings,
 * and checkpoint saves are permanently preserved in terminal history.
 */
export function rollupTelemetryEvents(events: PipelineEvent[]): PipelineEvent[] {
  if (events.length === 0) return [];
  const result: PipelineEvent[] = [];

  for (const ev of events) {
    const msg = ev.message || "";
    const isProg = ev.is_progress || isProgressLine(msg);

    if (isProg && result.length > 0) {
      const last = result[result.length - 1];
      const lastIsProg = last.is_progress || isProgressLine(last.message || "");
      if (lastIsProg && last.step_name === ev.step_name && last.origin === ev.origin) {
        result[result.length - 1] = ev;
        continue;
      }
    }

    result.push(ev);
  }

  return result;
}

/** Messages that mark the end of a whole pipeline run. */
const PIPELINE_DONE_MARKERS = ["pipeline execution completed", "ecosystem healthy status"];

/**
 * True when an event ends its step or run: an error, a non-progress success
 * or warning, or the pipeline's completion message. Words such as
 * "completed" inside an ordinary progress line ("epoch 3 completed") do not count.
 */
export function isTerminalEvent(ev: PipelineEvent): boolean {
  if (ev.status === "error") return true;
  if (!ev.is_progress && (ev.status === "success" || ev.status === "warning")) return true;
  const msg = typeof ev.message === "string" ? ev.message.toLowerCase() : "";
  return PIPELINE_DONE_MARKERS.some((marker) => msg.includes(marker));
}

/**
 * Text for a screen-reader status region: the latest milestone (a
 * non-progress success, warning or error) instead of every log line.
 */
export function latestMilestone(events: readonly PipelineEvent[]): string {
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (!ev.is_progress && ev.status !== "info") return `${ev.step_name}: ${ev.message}`;
  }
  return "";
}
