/**
 * LemGendary AI Studio - Training Suite: training dispatch, jobs, evaluation and export.
 */

import { logger } from "../utils/logger";
import { TRAINING_BASE } from "./endpoints";
import { sidecarFetch } from "./http";
import { throwSidecarError } from "./request";
import {
  LLMTrainingConfig,
  LLMTrainResponse,
  ModelEvalPayload,
  ModelExportPayload,
  QuickTrainPayload,
  TrainingJobInfo,
  UnitTestAllPayload,
} from "./types";

export async function triggerQuickTrain(payload: QuickTrainPayload): Promise<{ status: string; job_id?: string }> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/gui/quick-train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to trigger training: ${res.statusText}`);
  return res.json();
}

export async function fetchRunningTrainingJobs(): Promise<TrainingJobInfo[]> {
  try {
    const res = await sidecarFetch(`${TRAINING_BASE}/api/jobs?status=running`);
    if (!res.ok) {
      logger.warn(`Running jobs request failed: HTTP ${res.status} ${res.statusText}`);
      return [];
    }
    return (await res.json()) as TrainingJobInfo[];
  } catch (err: unknown) {
    logger.warn("Training Suite is unreachable; no running jobs listed", err);
    return [];
  }
}

/** Job states after which the sidecar job manager never touches a job again. */
export const TERMINAL_JOB_STATUSES: ReadonlySet<string> = new Set(["completed", "failed", "cancelled"]);

export interface CancelJobResult {
  job_id: string;
  status: string;
  cancelled: boolean;
  message?: string;
}

/**
 * Cancel a sidecar job (`POST /api/jobs/{job_id}/cancel`).
 * Resolves only when the sidecar confirms the job is cancelled; throws with the
 * sidecar's detail otherwise (HTTP error, 404, or `cancelled: false`).
 */
export async function cancelTrainingJob(jobId: string): Promise<CancelJobResult> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: "POST",
  });
  if (!res.ok) return throwSidecarError(res, `Cancel request failed: HTTP ${res.status} ${res.statusText}`);
  const data = (await res.json()) as CancelJobResult;
  if (!data.cancelled || data.status !== "cancelled") {
    throw new Error(
      `${data.message || "Sidecar did not cancel the job."} (job ${data.job_id || jobId}, status: ${data.status || "unknown"})`
    );
  }
  return data;
}

/** Read one sidecar job record (`GET /api/jobs/{job_id}`); throws on any failure. */
export async function fetchTrainingJob(jobId: string): Promise<TrainingJobInfo> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/jobs/${encodeURIComponent(jobId)}`);
  if (!res.ok) return throwSidecarError(res, `Job status request failed: HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as TrainingJobInfo;
}

export async function triggerUnitTestAll(payload: UnitTestAllPayload = {}): Promise<{ job_id: string; status: string; message: string }> {
  const resp = await sidecarFetch(`${TRAINING_BASE}/api/training/unit-test-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    throw new Error(`Failed to trigger 1-epoch diagnostic unit test: ${resp.status}`);
  }
  return resp.json();
}

export async function triggerModelEvaluate(payload: ModelEvalPayload): Promise<{ job_id: string; status: string; message: string }> {
  const resp = await sidecarFetch(`${TRAINING_BASE}/api/training/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    throw new Error(`Failed to enqueue evaluation: ${resp.status}`);
  }
  return resp.json();
}

export async function triggerModelExport(payload: ModelExportPayload): Promise<{ job_id: string; status: string; message: string }> {
  const resp = await sidecarFetch(`${TRAINING_BASE}/api/training/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    throw new Error(`Failed to enqueue export: ${resp.status}`);
  }
  return resp.json();
}

/** Result of `POST /api/models/{model_key}/soup`. */
export interface BlendSoupResponse {
  model_key: string;
  success: boolean;
  soup_checkpoint: string | null;
  donors?: string[];
  weights?: number[];
}

/** Blend the model's vault checkpoints into one Pareto Model Soup checkpoint (uniform weights). */
export async function blendModelSoup(modelKey: string): Promise<BlendSoupResponse> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/models/${encodeURIComponent(modelKey)}/soup`, {
    method: "POST",
  });
  if (!res.ok) return throwSidecarError(res, `Failed to blend model soup: HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

export async function trainLLM(config: LLMTrainingConfig): Promise<LLMTrainResponse> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/training/llm/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) return throwSidecarError(res, `Failed to dispatch LLM training: ${res.statusText}`);
  return res.json();
}
