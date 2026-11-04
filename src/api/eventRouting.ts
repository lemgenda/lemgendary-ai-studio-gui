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

function isTrainingSuiteEvent(ev: PipelineEvent): boolean {
  // Semantic origin routing - fully protocol-, host-, and port-agnostic
  if (ev.origin) {
    return ev.origin === "training-suite";
  }
  const step = (ev.step_name || "").toLowerCase();
  return step.includes("train");
}

/**
 * True when a training-suite event belongs to a remote (cloud) job: its `job_id`
 * matches the attached remote job, or its `job_type` is a remote job type.
 */
export function isRemoteTrainingEvent(ev: PipelineEvent, remoteJobId?: string | null): boolean {
  if (!ev || !isTrainingSuiteEvent(ev)) return false;
  const jobId = ev.data?.job_id;
  const jobType = ev.data?.job_type;
  if (remoteJobId && typeof jobId === "string" && jobId === remoteJobId) return true;
  return typeof jobType === "string" && REMOTE_TRAINING_JOB_TYPES.has(jobType);
}

export function isLocalTrainingEvent(ev: PipelineEvent, remoteJobId?: string | null): boolean {
  if (!ev) return false;
  return isTrainingSuiteEvent(ev) && !isRemoteTrainingEvent(ev, remoteJobId);
}
