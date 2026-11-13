/**
 * LemGendary AI Studio - the Training Suite refusal of a resume whose frozen run
 * settings changed (`FrozenSettingsChanged`, `training/run_settings/policy.py`):
 *
 *   "Resume refused: frozen run settings changed since the run started:
 *    <key> <old> -> <new>; ... . Start a fresh run with --clean, or accept the
 *    change with --override-frozen."
 *
 * Old and new values are canonical JSON (`describe_changes`). The text reaches the
 * GUI as the failed job's `error_message` (local runs) or as a job log line.
 */

import { PipelineEvent, TrainingJobInfo } from "../../api/types";

export const FROZEN_REFUSAL_MARKER = "Resume refused: frozen run settings changed since the run started: ";

/** Start of the advice sentence that closes the refusal. */
const FROZEN_REFUSAL_ADVICE = ". Start a fresh run with --clean";

/** Closing words of the refusal message. */
const FROZEN_REFUSAL_END = "--override-frozen.";

const CHANGE_SEPARATOR = "; ";
const VALUE_ARROW = " -> ";

export interface FrozenSettingChange {
  key: string;
  /** Canonical JSON of the value the run started with. */
  old: string;
  /** Canonical JSON of the configured value. */
  new: string;
}

export interface FrozenRefusal {
  /** The refusal message as the Training Suite wrote it. */
  message: string;
  /** Changed settings; empty when the change list could not be read. */
  changes: FrozenSettingChange[];
}

/** One `key old -> new` item; null when it does not have that shape. */
function parseChange(item: string): FrozenSettingChange | null {
  const keyEnd = item.indexOf(" ");
  const arrow = item.indexOf(VALUE_ARROW, keyEnd + 1);
  if (keyEnd <= 0 || arrow < 0) return null;
  return {
    key: item.slice(0, keyEnd),
    old: item.slice(keyEnd + 1, arrow),
    new: item.slice(arrow + VALUE_ARROW.length),
  };
}

/** The refusal in `text` (a job error or a log line); null when it holds none. */
export function parseFrozenRefusal(text: string | null | undefined): FrozenRefusal | null {
  if (!text) return null;
  const start = text.indexOf(FROZEN_REFUSAL_MARKER);
  if (start < 0) return null;
  const listStart = start + FROZEN_REFUSAL_MARKER.length;
  const adviceAt = text.indexOf(FROZEN_REFUSAL_ADVICE, listStart);
  const listText = adviceAt < 0 ? text.slice(listStart) : text.slice(listStart, adviceAt);
  const endAt = text.indexOf(FROZEN_REFUSAL_END, listStart);
  const message = endAt < 0 ? text.slice(start).trim() : text.slice(start, endAt + FROZEN_REFUSAL_END.length);
  const items = listText.split(CHANGE_SEPARATOR).map(parseChange);
  const changes = items.every((c): c is FrozenSettingChange => c !== null) ? items : [];
  return { message, changes };
}

/**
 * The refusal of a failed job: its `error_message` first, else the newest log line of
 * the job in `events` that carries it. null for any other job or failure.
 */
export function findFrozenRefusal(job: TrainingJobInfo, events: readonly PipelineEvent[]): FrozenRefusal | null {
  if (job.status !== "failed") return null;
  const fromError = parseFrozenRefusal(job.error_message);
  if (fromError) return fromError;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i];
    if (ev.data?.job_id !== job.id) continue;
    const fromLog = parseFrozenRefusal(ev.message);
    if (fromLog) return fromLog;
  }
  return null;
}
