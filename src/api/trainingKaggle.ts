/**
 * LemGendary AI Studio - Training Suite Kaggle cloud engine orchestration.
 */

import { logger } from "../utils/logger";
import { TRAINING_BASE } from "./endpoints";
import { sidecarFetch } from "./http";
import { throwSidecarError } from "./request";
import { fetchSecrets } from "./secrets";
import {
  KaggleKernelItem,
  KaggleMonitorPayload,
  KagglePushAllPayload,
  KagglePushAllResponse,
  KagglePushModelPayload,
  KagglePushModelResponse,
  KaggleSuiteStatus,
  KaggleTrainPayload,
} from "./types";

const KAGGLE_SUITE_UNAUTHENTICATED: KaggleSuiteStatus = { authenticated: false, username: "", token_configured: false };

/** Training Suite Kaggle status merged with the vault's default Kaggle secret; failures are logged. */
export async function fetchKaggleSuiteStatus(): Promise<KaggleSuiteStatus> {
  try {
    const [res, secrets] = await Promise.all([
      sidecarFetch(`${TRAINING_BASE}/api/training/kaggle/status`).catch((err: unknown) => {
        logger.warn("Training Suite Kaggle status is unreachable", err);
        return null;
      }),
      fetchSecrets(),
    ]);

    const defaultKaggle = secrets.find(
      (s) => s.service.toLowerCase() === "kaggle" && s.is_default
    );

    const data: KaggleSuiteStatus =
      res && res.ok ? ((await res.json()) as KaggleSuiteStatus) : { ...KAGGLE_SUITE_UNAUTHENTICATED };

    if (defaultKaggle && defaultKaggle.username) {
      data.username = defaultKaggle.username;
      data.token_configured = defaultKaggle.has_value;
      if (defaultKaggle.has_value) {
        data.authenticated = true;
      }
    }
    return data;
  } catch (err: unknown) {
    logger.warn("Kaggle suite status response could not be read", err);
    return { ...KAGGLE_SUITE_UNAUTHENTICATED };
  }
}

export async function fetchKaggleKernels(limit: number = 20): Promise<KaggleKernelItem[]> {
  try {
    const res = await sidecarFetch(`${TRAINING_BASE}/api/training/kaggle/kernels?limit=${limit}`);
    if (!res.ok) {
      logger.warn(`Kaggle kernels request failed: HTTP ${res.status} ${res.statusText}`);
      return [];
    }
    return (await res.json()) as KaggleKernelItem[];
  } catch (err: unknown) {
    logger.warn("Training Suite is unreachable; Kaggle kernel list is empty", err);
    return [];
  }
}

export async function launchKaggleTrain(payload: KaggleTrainPayload): Promise<{ job_id: string; status: string; message: string; model: string }> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/training/kaggle/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return throwSidecarError(res, `Failed to launch Kaggle training: ${res.statusText}`);
  return res.json();
}

export async function monitorKaggleKernel(payload: KaggleMonitorPayload): Promise<{ job_id: string; status: string; message: string; kernel_slug: string }> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/training/kaggle/monitor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return throwSidecarError(res, `Failed to connect to Kaggle kernel: ${res.statusText}`);
  return res.json();
}

export async function pullKaggleModelArtifacts(model: string): Promise<{ job_id: string; status: string; model: string; message: string }> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/training/kaggle/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) return throwSidecarError(res, `Failed to pull Kaggle artifacts: ${res.statusText}`);
  return res.json();
}

export async function pushKaggleModelArtifacts(model: string): Promise<{ job_id: string; status: string; model: string; message: string }> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/training/kaggle/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) return throwSidecarError(res, `Failed to push Kaggle artifacts: ${res.statusText}`);
  return res.json();
}

export async function pushKaggleModelVariation(payload: KagglePushModelPayload): Promise<KagglePushModelResponse> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/training/kaggle/push-model`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return throwSidecarError(res, `Failed to push model variation to Kaggle: ${res.statusText}`);
  return res.json();
}

export async function pushAllKaggleModels(payload: KagglePushAllPayload = {}): Promise<KagglePushAllResponse> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/training/kaggle/push-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return throwSidecarError(res, `Failed to enqueue fleet Kaggle push: ${res.statusText}`);
  return res.json();
}
