/**
 * LemGendary AI Studio - Training Suite notebooks, model docs and variations.
 */

import { TRAINING_BASE } from "./endpoints";
import { sidecarFetch } from "./http";
import { throwSidecarError } from "./request";
import { ModelDocGenResponse, ModelStageResponse, ModelValidateIsolationResponse } from "./types";

export interface GenerateNotebooksPayload {
  model_key: string;
  platform?: "kaggle" | "colab" | "all";
  kinds?: ("training" | "inference" | "usage")[];
  output_dir?: string;
}

export interface GenerateNotebooksResponse {
  success: boolean;
  model_key: string;
  platform: string;
  generated: Record<string, string>;
}

export async function generateNotebooks(
  payload: GenerateNotebooksPayload
): Promise<GenerateNotebooksResponse> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/notebooks/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return throwSidecarError(res, `Failed to generate notebooks: ${res.statusText}`);
  return res.json();
}

export async function generateAllNotebooks(platform: string = "all"): Promise<{ success: boolean; total_models: number; total_files: number }> {
  const resp = await sidecarFetch(`${TRAINING_BASE}/api/notebooks/generate-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform }),
  });
  if (!resp.ok) {
    throw new Error(`Failed to batch generate notebooks: ${resp.status}`);
  }
  return resp.json();
}

export async function generateModelDocs(modelKey: string): Promise<ModelDocGenResponse> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/models/${encodeURIComponent(modelKey)}/docs/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) return throwSidecarError(res, `Failed to generate model documentation: ${res.statusText}`);
  return res.json();
}

export async function stageModelVariations(modelKey: string): Promise<ModelStageResponse> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/models/${encodeURIComponent(modelKey)}/export/stage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) return throwSidecarError(res, `Failed to stage model variations: ${res.statusText}`);
  return res.json();
}

export async function validateModelIsolation(modelKey: string): Promise<ModelValidateIsolationResponse> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/models/${encodeURIComponent(modelKey)}/variations/validate`);
  if (!res.ok) return throwSidecarError(res, `Failed to validate model isolation: ${res.statusText}`);
  return res.json();
}
