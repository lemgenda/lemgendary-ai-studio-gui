/**
 * LemGendary AI Studio - Dataset Compiler: catalog, presets, compilation and modernization.
 */

import { logger } from "../utils/logger";
import { DATASETS_BASE } from "./endpoints";
import { sidecarFetch } from "./http";
import { postJsonOrThrow, throwHttpError, throwSidecarError } from "./request";
import {
  BackendDatasetStats,
  CompilerPreset,
  CompilerPresetListResponse,
  ConfigValidationResponse,
  CustomCompilePayload,
  DatasetItem,
  DatasetJobResponse,
  ManifoldReducePayload,
  ModernizationQueueItem,
  ModernizeRunPayload,
  QuickCompilePayload,
  RegenerateManifoldsResponse,
} from "./types";

export async function fetchDatasets(): Promise<DatasetItem[]> {
  try {
    const res = await sidecarFetch(`${DATASETS_BASE}/api/gui/datasets/with-stats`);
    if (!res.ok) {
      logger.warn(`Dataset catalog request failed: HTTP ${res.status} ${res.statusText}`);
      return [];
    }
    const data = (await res.json()) as { datasets?: unknown };
    if (!data.datasets || !Array.isArray(data.datasets)) {
      logger.warn("Dataset catalog response has no datasets list", data);
      return [];
    }

    return (data.datasets as BackendDatasetStats[]).map((item: BackendDatasetStats): DatasetItem => {
      const key = item.key || item.name.toLowerCase().replace(/^lemgendized/, "");
      const displayName = item.display_name || item.name.replace(/^LemGendized/, "");
      const totalSamples = item.sample_count ?? 0;
      const totalSizeMb = Math.round((item.size_bytes || 0) / (1024 * 1024));
      const formatBreakdown = {
        webp: item.formats?.webp ?? 0,
        jpg: item.formats?.jpg ?? 0,
        png: item.formats?.png ?? 0,
        parquet: item.formats?.parquet ?? 0,
        other: item.formats?.other ?? 0,
      };
      const isCompiled = Boolean(
        item.is_compiled ?? (item.shards_count && item.shards_count > 0)
      );

      return {
        key,
        display_name: displayName,
        format: item.format || "directory",
        canonical_format: item.canonical_format || "webdataset",
        total_samples: totalSamples,
        total_size_mb: totalSizeMb,
        format_breakdown: formatBreakdown,
        shards_count: item.shards_count ?? 0,
        is_compiled: isCompiled,
        modernized_folder: item.name,
        task: item.task || "vision",
        sources: item.sources || [],
        kaggle_ref: item.kaggle_ref,
        recommended_preset: item.recommended_preset,
      };
    });
  } catch (err: unknown) {
    logger.warn("Dataset Compiler is unreachable; dataset catalog is empty", err);
    return [];
  }
}

/**
 * Compiler presets from `presets.yaml` (`GET /api/gui/presets`), sorted by name.
 * The server returns a dict keyed by preset name; throws when the sidecar is unreachable or answers with an error.
 */
export async function fetchCompilerPresets(): Promise<CompilerPreset[]> {
  const res = await sidecarFetch(`${DATASETS_BASE}/api/gui/presets`);
  if (!res.ok) {
    return throwHttpError(res, "Preset request");
  }
  return parseCompilerPresets(await res.json());
}

/** Turn the `PresetListResponse` dict into a list; rejects any other shape. */
export function parseCompilerPresets(data: unknown): CompilerPreset[] {
  const presets = (data as Partial<CompilerPresetListResponse> | null)?.presets;
  if (typeof presets !== "object" || presets === null || Array.isArray(presets)) {
    throw new Error("Preset response is not the PresetListResponse dict ({presets: {name: preset}, total}).");
  }
  return Object.entries(presets)
    .map(([name, preset]) => ({ ...preset, name: preset.name || name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function triggerQuickCompile(payload: QuickCompilePayload): Promise<DatasetJobResponse> {
  return postJsonOrThrow<DatasetJobResponse>(`${DATASETS_BASE}/api/gui/quick-compile`, payload, "Compilation request");
}

/**
 * Validate `unified_data.yaml` against the compiler's config schema
 * (`POST /api/config/validate`). The route needs no API token; the origin
 * guard admits it with the client header `sidecarFetch` sends. Throws with
 * the schema error (HTTP 422) or the missing-file detail (HTTP 404).
 */
export async function validateCompilerConfig(): Promise<ConfigValidationResponse> {
  return postJsonOrThrow<ConfigValidationResponse>(`${DATASETS_BASE}/api/config/validate`, undefined, "Schema validation");
}

export async function triggerCustomCompile(payload: CustomCompilePayload): Promise<DatasetJobResponse> {
  return postJsonOrThrow<DatasetJobResponse>(`${DATASETS_BASE}/api/gui/custom-compile`, payload, "Custom compilation request");
}

/** `GET /api/modernize/queue` returns a bare list of queue items. */
export async function fetchModernizationQueue(): Promise<ModernizationQueueItem[]> {
  const resp = await sidecarFetch(`${DATASETS_BASE}/api/modernize/queue`);
  if (!resp.ok) {
    return throwSidecarError(resp, `Failed to fetch modernization queue: HTTP ${resp.status}`);
  }
  return parseModernizationQueue(await resp.json());
}

/** Validate the bare-list queue response; rejects any other shape. */
export function parseModernizationQueue(data: unknown): ModernizationQueueItem[] {
  if (!Array.isArray(data)) {
    throw new Error("Modernization queue response is not a list.");
  }
  return data as ModernizationQueueItem[];
}

export async function triggerModernizationRun(payload: ModernizeRunPayload): Promise<DatasetJobResponse> {
  return postJsonOrThrow<DatasetJobResponse>(`${DATASETS_BASE}/api/modernize/run`, payload, "Modernization run");
}

export async function triggerManifoldReduce(payload: ManifoldReducePayload): Promise<DatasetJobResponse> {
  return postJsonOrThrow<DatasetJobResponse>(`${DATASETS_BASE}/api/modernize/reduce`, payload, "Manifold scale reduction");
}

export async function triggerRegenerateManifolds(): Promise<RegenerateManifoldsResponse> {
  return postJsonOrThrow<RegenerateManifoldsResponse>(`${DATASETS_BASE}/api/modernize/regenerate-manifolds`, undefined, "Regenerate manifolds");
}
