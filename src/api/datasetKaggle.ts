/**
 * LemGendary AI Studio - Dataset Compiler Kaggle dataset sync.
 */

import { logger } from "../utils/logger";
import { DATASETS_BASE } from "./endpoints";
import { sidecarFetch } from "./http";
import { postJsonOrThrow } from "./request";
import {
  DatasetJobResponse,
  KaggleDatasetRegistryItem,
  KaggleDownloadPayload,
  KaggleStatusResponse,
  KaggleUploadPayload,
} from "./types";

const KAGGLE_UNAUTHENTICATED: KaggleStatusResponse = {
  authenticated: false,
  auth_methods: { environment_variables: false, secrets_vault: false, dot_kaggle_token: false, user_kaggle_json: false },
};

/** Kaggle auth state from the Dataset Compiler; failures are logged and read as unauthenticated. */
export async function fetchKaggleStatus(): Promise<KaggleStatusResponse> {
  try {
    const res = await sidecarFetch(`${DATASETS_BASE}/api/kaggle/status`);
    if (!res.ok) {
      logger.warn(`Kaggle status request failed: HTTP ${res.status} ${res.statusText}`);
      return KAGGLE_UNAUTHENTICATED;
    }
    return (await res.json()) as KaggleStatusResponse;
  } catch (err: unknown) {
    logger.warn("Dataset Compiler is unreachable; Kaggle reads as unauthenticated", err);
    return KAGGLE_UNAUTHENTICATED;
  }
}

export async function fetchKaggleRegistryDatasets(): Promise<KaggleDatasetRegistryItem[]> {
  try {
    const res = await sidecarFetch(`${DATASETS_BASE}/api/kaggle/registry-datasets`);
    if (!res.ok) {
      logger.warn(`Kaggle registry request failed: HTTP ${res.status} ${res.statusText}`);
      return [];
    }
    return (await res.json()) as KaggleDatasetRegistryItem[];
  } catch (err: unknown) {
    logger.warn("Dataset Compiler is unreachable; Kaggle registry is empty", err);
    return [];
  }
}

export async function downloadKaggleDataset(payload: KaggleDownloadPayload): Promise<DatasetJobResponse> {
  return postJsonOrThrow<DatasetJobResponse>(`${DATASETS_BASE}/api/kaggle/download`, payload, "Kaggle download request");
}

export async function uploadKaggleDataset(payload: KaggleUploadPayload): Promise<DatasetJobResponse> {
  return postJsonOrThrow<DatasetJobResponse>(`${DATASETS_BASE}/api/kaggle/upload`, payload, "Kaggle upload request");
}

export interface KaggleMetadataPayload {
  manifold?: string;
  kaggle_ref?: string;
  all_datasets?: boolean;
}

export async function updateKaggleMetadata(payload: KaggleMetadataPayload): Promise<DatasetJobResponse> {
  return postJsonOrThrow<DatasetJobResponse>(`${DATASETS_BASE}/api/kaggle/update-metadata`, payload, "Kaggle metadata update");
}

export async function updateAllKaggleMetadata(): Promise<DatasetJobResponse> {
  return updateKaggleMetadata({ all_datasets: true });
}
