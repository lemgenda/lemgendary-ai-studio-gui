/**
 * LemGendary AI Studio - Training Suite Kaggle cloud engine orchestration.
 */

import { logger } from "../utils/logger";
import { ECOSYSTEM } from "./ecosystem";
import { TRAINING_BASE } from "./endpoints";
import { sidecarFetch } from "./http";
import { throwSidecarError } from "./request";
import {
  KaggleAcceleratorList,
  KaggleKernelItem,
  KaggleMonitorPayload,
  KagglePushAllPayload,
  KagglePushAllResponse,
  KagglePushModelPayload,
  KagglePushModelResponse,
  KaggleSuiteStatus,
  KaggleTrainPayload,
} from "./types";

/** Status shown when the Training Suite could not be asked; `error` says why. */
function unreachableKaggleStatus(error: string): KaggleSuiteStatus {
  return {
    authenticated: false,
    username: "",
    token_configured: false,
    auth_method: null,
    http_status: null,
    error,
  };
}

/**
 * Training Suite Kaggle status: the outcome of its real authenticated call, shown as sent.
 * The GUI never upgrades it to authenticated (a stored vault secret is not proof that Kaggle
 * accepts it). Failures are logged and read as unauthenticated with the reason in `error`.
 */
export async function fetchKaggleSuiteStatus(): Promise<KaggleSuiteStatus> {
  let res: Response;
  try {
    res = await sidecarFetch(`${TRAINING_BASE}/api/training/kaggle/status`);
  } catch (err: unknown) {
    logger.warn("Training Suite Kaggle status is unreachable", err);
    return unreachableKaggleStatus("Training Suite is unreachable");
  }
  if (!res.ok) {
    logger.warn(`Kaggle status request failed: HTTP ${res.status} ${res.statusText}`);
    return unreachableKaggleStatus(`Kaggle status request failed: HTTP ${res.status}`);
  }
  try {
    const data = (await res.json()) as Partial<KaggleSuiteStatus>;
    return {
      authenticated: data.authenticated === true,
      username: data.username ?? "",
      token_configured: data.token_configured === true,
      auth_method: data.auth_method ?? null,
      http_status: data.http_status ?? null,
      error: data.error ?? null,
    };
  } catch (err: unknown) {
    logger.warn("Kaggle suite status response could not be read", err);
    return unreachableKaggleStatus("Kaggle status response could not be read");
  }
}

/** Kaggle accelerators of the ecosystem snapshot: the same SSOT the route serves. */
export function snapshotKaggleAccelerators(): KaggleAcceleratorList {
  const retired = new Set(ECOSYSTEM.kaggle.retired_machine_shapes);
  return {
    default: ECOSYSTEM.kaggle.default_accelerator,
    accelerators: ECOSYSTEM.kaggle.accelerators.filter(
      (acc) => acc.machine_shape === null || !retired.has(acc.machine_shape)
    ),
  };
}

/** Where an accelerator list came from: the live route or the offline snapshot. */
export type KaggleAcceleratorSource = "sidecar" | "snapshot";

export interface KaggleAcceleratorChoices {
  list: KaggleAcceleratorList;
  source: KaggleAcceleratorSource;
}

/**
 * `GET /api/training/kaggle/accelerators`; falls back to the ecosystem snapshot while the
 * Training Suite is offline (the fallback is logged).
 */
export async function fetchKaggleAccelerators(): Promise<KaggleAcceleratorChoices> {
  try {
    const res = await sidecarFetch(`${TRAINING_BASE}/api/training/kaggle/accelerators`);
    if (res.ok) {
      const list = (await res.json()) as KaggleAcceleratorList;
      if (Array.isArray(list.accelerators) && list.accelerators.length > 0) return { list, source: "sidecar" };
      logger.warn("Kaggle accelerator list is empty; using the ecosystem snapshot");
    } else {
      logger.warn(`Kaggle accelerators request failed: HTTP ${res.status} ${res.statusText}; using the ecosystem snapshot`);
    }
  } catch (err: unknown) {
    logger.warn("Training Suite is unreachable; Kaggle accelerators come from the ecosystem snapshot", err);
  }
  return { list: snapshotKaggleAccelerators(), source: "snapshot" };
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
