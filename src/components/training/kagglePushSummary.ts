/**
 * LemGendary AI Studio - display of a Kaggle Models Hub push result
 * (`POST /api/training/kaggle/push-model`, `ModelPushResult.to_dict`).
 *
 * The route answers HTTP 200 also when the push failed (`success: false`, for example
 * "Model page metadata sync failed; nothing uploaded"), so the GUI reads the body.
 */

import { BannerType } from "../common/ValidationBanner";
import { KagglePushModelResponse } from "../../api/types";

/** Text of a variation whose payload equals its last upload (no new Hub version). */
export const UNCHANGED_VARIATION_TEXT = "unchanged, no new version";

export interface PushStatusMessage {
  type: BannerType;
  message: string;
}

function variationLine(name: string, v: KagglePushModelResponse["variations"][string]): string {
  if (!v.success) return `${name}: failed${v.error ? ` (${v.error})` : ""}`;
  if (v.skipped) return `${name}: ${UNCHANGED_VARIATION_TEXT}`;
  if (v.dry_run) return `${name}: verified (${v.files.length} file(s))`;
  return `${name}: uploaded (${v.files.length} file(s))`;
}

/** Banner type and text of a push (or dry run) of `modelKey`. */
export function summarizeKagglePush(modelKey: string, res: KagglePushModelResponse, dryRun: boolean): PushStatusMessage {
  const entries = Object.entries(res.variations || {});
  const details = entries.map(([name, v]) => variationLine(name, v)).join("; ");
  const suffix = details ? ` ${details}.` : "";
  if (!res.success) {
    const errors = res.errors?.length ? res.errors.join("; ") : "the Training Suite reported a failed push";
    return { type: "error", message: `Kaggle push failed for ${modelKey}: ${errors}.${suffix}` };
  }
  if (dryRun) {
    return { type: "success", message: `[DRY RUN PASSED] Verified ${entries.length} variation payload(s) for ${modelKey}.${suffix}` };
  }
  const uploaded = entries.filter(([, v]) => !v.skipped).length;
  if (entries.length > 0 && uploaded === 0) {
    return { type: "info", message: `Nothing new to publish for ${modelKey}: every variation is ${UNCHANGED_VARIATION_TEXT}.${suffix}` };
  }
  return { type: "success", message: `Published ${uploaded} of ${entries.length} variation(s) for ${modelKey} to Kaggle Models Hub.${suffix}` };
}
