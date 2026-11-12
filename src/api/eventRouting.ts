/**
 * LemGendary AI Studio - origin-based routing of telemetry events to consoles.
 */

import { PipelineEvent } from "./types";

export function isCompilerEvent(ev: PipelineEvent): boolean {
  if (!ev) return false;
  // Semantic origin routing - fully protocol-, host-, and port-agnostic
  if (ev.origin) {
    return ev.origin === "dataset-compiler";
  }
  const step = (ev.step_name || "").toLowerCase();
  return step.includes("compiler");
}

/**
 * Job types the training-suite job manager runs against a remote (Kaggle) kernel.
 * Mirrors the sidecar's "Cloud Training" step classification in `training/server/jobs.py`.
 */
export const REMOTE_TRAINING_JOB_TYPES: ReadonlySet<string> = new Set(["kaggle_train", "kaggle_monitor", "cloud_push"]);

/**
 * Kaggle Models Hub transfer jobs (`POST /api/training/kaggle/push`, `/push-all`, `/pull`).
 * They do not train, so a running one is never restored as the remote training job,
 * but their output belongs to the Remote Cloud console.
 */
export const REMOTE_TRANSFER_JOB_TYPES: ReadonlySet<string> = new Set(["kaggle_push", "kaggle_push_all", "kaggle_pull"]);

/** True when a training-suite `job_type` streams to the Remote Cloud console. */
export function isRemoteConsoleJobType(jobType: string): boolean {
  return REMOTE_TRAINING_JOB_TYPES.has(jobType) || REMOTE_TRANSFER_JOB_TYPES.has(jobType);
}

function isTrainingSuiteEvent(ev: PipelineEvent): boolean {
  // Semantic origin routing - fully protocol-, host-, and port-agnostic
  if (ev.origin) {
    return ev.origin === "training-suite";
  }
  const step = (ev.step_name || "").toLowerCase();
  return step.includes("train");
}

/**
 * True when a training-suite event belongs to the Remote Cloud console: its `job_id`
 * matches the attached remote job, or its `job_type` is a remote training or
 * Kaggle transfer (push, push-all, pull) job type.
 */
export function isRemoteTrainingEvent(ev: PipelineEvent, remoteJobId?: string | null): boolean {
  if (!ev || !isTrainingSuiteEvent(ev)) return false;
  const jobId = ev.data?.job_id;
  const jobType = ev.data?.job_type;
  if (remoteJobId && typeof jobId === "string" && jobId === remoteJobId) return true;
  return typeof jobType === "string" && isRemoteConsoleJobType(jobType);
}

export function isLocalTrainingEvent(ev: PipelineEvent, remoteJobId?: string | null): boolean {
  if (!ev) return false;
  return isTrainingSuiteEvent(ev) && !isRemoteTrainingEvent(ev, remoteJobId);
}
