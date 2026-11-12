/**
 * LemGendary AI Studio - Kaggle push lines of the Training Suite job log that the
 * consoles must not treat as plain progress (`training/server/job_kaggle_sync.py`,
 * `training/cloud/kaggle_model_sync.py`).
 */

import { PipelineEvent } from "./types";

/** `[UPLOAD] [Step i/n] UNCHANGED (no new version) <model> [<variation>] (p%)`. */
export const KAGGLE_UNCHANGED_MARKER = "UNCHANGED (no new version)";

/** Part of "Model page metadata sync failed; nothing uploaded: <reasons>". */
export const KAGGLE_PAGE_SYNC_FAILED_MARKER = "Model page metadata sync failed; nothing uploaded";

/**
 * Status of a Kaggle push notice line: an unchanged variation is a warning (no new
 * Hub version), a failed model page sync is an error. null for any other line.
 */
export function kaggleLogStatus(message: string): Extract<PipelineEvent["status"], "warning" | "error"> | null {
  if (message.includes(KAGGLE_PAGE_SYNC_FAILED_MARKER)) return "error";
  if (message.includes(KAGGLE_UNCHANGED_MARKER)) return "warning";
  return null;
}
