/**
 * LemGendary AI Studio - banner text for a sidecar job that reached a terminal
 * state (`GET /api/jobs/{job_id}`): status, error message and the result
 * metrics the Kaggle jobs record (`training/server/job_kaggle_run.py`,
 * `job_kaggle_sync.py`).
 */

import { TrainingJobInfo } from "../../api/types";
import { UNCHANGED_VARIATION_TEXT } from "./kagglePushSummary";

export interface JobOutcome {
  kind: "notice" | "error";
  message: string;
}

/** Variation names whose push was skipped because the payload was unchanged. */
function unchangedVariations(metrics: Record<string, unknown>): string[] {
  const variations = metrics.variations;
  if (!variations || typeof variations !== "object") return [];
  return Object.entries(variations as Record<string, { skipped?: unknown }>)
    .filter(([, v]) => v && typeof v === "object" && v.skipped === true)
    .map(([name]) => name);
}

/** Banner labels of the transfer jobs the training panel tracks (model card Push / Pull). */
export const TRANSFER_JOB_LABELS: ReadonlyMap<string, string> = new Map([
  ["kaggle_push", "Kaggle push job"],
  ["kaggle_pull", "Kaggle pull job"],
]);

/** Banner label of a transfer job type; a generic one for an unknown type. */
export function transferJobLabel(jobType: string | null | undefined): string {
  return (jobType && TRANSFER_JOB_LABELS.get(jobType)) || "Kaggle transfer job";
}

/** Readable details of a completed job's metrics; empty when there are none. */
export function jobMetricsDetails(metrics: Record<string, unknown> | undefined): string[] {
  if (!metrics) return [];
  const details: string[] = [];
  if (typeof metrics.kernel_slug === "string" && metrics.kernel_slug) details.push(`Kernel: ${metrics.kernel_slug}.`);
  if (metrics.deadline_stop === true) {
    details.push("Stopped at the Kaggle session deadline; progress was saved and the next session resumes from the Hub.");
  }
  if (typeof metrics.resumes === "number" && metrics.resumes > 0) {
    details.push(`Resume sessions pushed: ${metrics.resumes}.`);
  }
  const unchanged = unchangedVariations(metrics);
  if (unchanged.length > 0) details.push(`${unchanged.join(", ")}: ${UNCHANGED_VARIATION_TEXT}.`);
  if (typeof metrics.variations_pulled === "number") details.push(`Variations pulled: ${metrics.variations_pulled}.`);
  return details;
}

/** Banner of a terminal job; `label` names it ("Local training job", "Cloud training job"). */
export function describeJobOutcome(label: string, jobId: string, job: TrainingJobInfo): JobOutcome {
  const reason = job.error_message ? `: ${job.error_message}` : ".";
  if (job.status === "failed") return { kind: "error", message: `${label} ${jobId} failed${reason}` };
  if (job.status === "cancelled") return { kind: "notice", message: `${label} ${jobId} cancelled${reason}` };
  const details = jobMetricsDetails(job.metrics);
  return { kind: "notice", message: [`${label} ${jobId} ${job.status}.`, ...details].join(" ") };
}
