/**
 * LemGendary AI Studio - Tripartite Multi-Sidecar API Client
 */

import {
  BackendDatasetStats,
  CompilerPreset,
  CustomCompilePayload,
  DatasetItem,
  DocsStatusResponse,
  EcosystemSidecarMesh,
  HardwareProfile,
  HealthAuditReport,
  KaggleDatasetRegistryItem,
  KaggleDownloadPayload,
  KaggleStatusResponse,
  KaggleUploadPayload,
  ManifestItem,
  ManifestReadResponse,
  ManifestSaveResponse,
  ManifestValidateResponse,
  MeshStatus,
  ModelItem,
  PipelineEvent,
  PipelineStatus,
  ProjectHealth,
  QuickCompilePayload,
  QuickTrainPayload,
  SecretItem,
  ServiceOperationResult,
} from "./types";

export type { MeshStatus, ServiceOperationResult };

export const ENV_BASE = "http://127.0.0.1:8000";
export const DATASETS_BASE = "http://127.0.0.1:8100";
export const TRAINING_BASE = "http://127.0.0.1:8200";

const WS_URL = "ws://127.0.0.1:8000/ws/log";

// ─── Environment Manager (Port 8000) ─────────────────────────────────────────

export async function fetchHardware(): Promise<HardwareProfile> {
  const res = await fetch(`${ENV_BASE}/api/hardware`);
  if (!res.ok) throw new Error(`Failed to fetch hardware profile: ${res.statusText}`);
  return res.json();
}

export async function fetchHealth(): Promise<HealthAuditReport> {
  const res = await fetch(`${ENV_BASE}/api/health`);
  if (!res.ok) throw new Error(`Failed to fetch health report: ${res.statusText}`);
  return res.json();
}

export async function fetchProjects(): Promise<ProjectHealth[]> {
  const res = await fetch(`${ENV_BASE}/api/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.statusText}`);
  return res.json();
}

export async function fetchPipelineStatus(): Promise<PipelineStatus> {
  const res = await fetch(`${ENV_BASE}/api/pipeline/status`);
  if (!res.ok) throw new Error(`Failed to fetch pipeline status: ${res.statusText}`);
  return res.json();
}

export async function triggerPipeline(targetProject?: string): Promise<{ status: string; message?: string }> {
  const res = await fetch(`${ENV_BASE}/api/pipeline/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_project: targetProject || null }),
  });
  if (!res.ok) throw new Error(`Failed to trigger pipeline: ${res.statusText}`);
  return res.json();
}

export async function fetchEcosystemMesh(): Promise<EcosystemSidecarMesh> {
  const res = await fetch(`${ENV_BASE}/api/gui/ecosystem`);
  if (!res.ok) throw new Error(`Failed to probe ecosystem mesh: ${res.statusText}`);
  return res.json();
}

/**
 * Lightweight reachability probe for a single sidecar port.
 * Uses a 1500 ms AbortController timeout so the UI never hangs waiting.
 * Falls back to false on any network error or timeout.
 */
export async function probeSidecarPort(port: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      method: "GET",
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

// ─── Ecosystem Sidecar Daemon Lifecycle Management (Port 8000) ───────────────

export async function startService(serviceId: string): Promise<ServiceOperationResult> {
  const res = await fetch(`${ENV_BASE}/api/services/${serviceId}/start`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to start ${serviceId}: ${res.statusText}`);
  }
  return res.json();
}

export async function stopService(serviceId: string): Promise<ServiceOperationResult> {
  const res = await fetch(`${ENV_BASE}/api/services/${serviceId}/stop`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to stop ${serviceId}: ${res.statusText}`);
  }
  return res.json();
}

export async function startAllServices(): Promise<{ results: Record<string, ServiceOperationResult> }> {
  const res = await fetch(`${ENV_BASE}/api/services/start-all`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to start all services: ${res.statusText}`);
  }
  return res.json();
}

// ─── Universal Manifest & Registry Editor (Port 8000) ───────────────────────

export async function fetchManifestRegistry(): Promise<ManifestItem[]> {
  const res = await fetch(`${ENV_BASE}/api/manifests/registry`);
  if (!res.ok) throw new Error(`Failed to fetch manifest registry: ${res.statusText}`);
  const data = await res.json();
  return data.manifests || [];
}

export async function readManifest(name: string): Promise<ManifestReadResponse> {
  const res = await fetch(`${ENV_BASE}/api/manifests/read?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Failed to read manifest '${name}': ${res.statusText}`);
  return res.json();
}

export async function validateManifest(name: string, content: string): Promise<ManifestValidateResponse> {
  const res = await fetch(`${ENV_BASE}/api/manifests/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, content }),
  });
  if (!res.ok) throw new Error(`Failed to validate manifest: ${res.statusText}`);
  return res.json();
}

export async function saveManifest(name: string, content: string): Promise<ManifestSaveResponse> {
  const res = await fetch(`${ENV_BASE}/api/manifests/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, content }),
  });
  if (!res.ok) throw new Error(`Failed to save manifest: ${res.statusText}`);
  return res.json();
}

// ─── Ecosystem Secrets & Tokens Vault ───────────────────────────────────────

export async function fetchSecrets(): Promise<SecretItem[]> {
  try {
    const res = await fetch(`${ENV_BASE}/api/secrets`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.secrets || [];
  } catch {
    return [];
  }
}

export async function saveSecrets(secrets: SecretItem[]): Promise<{ status: string; count: number; message: string }> {
  const res = await fetch(`${ENV_BASE}/api/secrets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secrets }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to save secrets: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchDocsStatus(): Promise<DocsStatusResponse> {
  try {
    const res = await fetch(`${ENV_BASE}/api/docs/status`);
    if (!res.ok) throw new Error("Offline docs unreachable");
    return res.json();
  } catch {
    return {
      offline_available: false,
      local_url: "http://127.0.0.1:8000/documentation-hub/index.html",
      online_url: "https://lemgenda.github.io/ai-training-whitepapers/index.html",
    };
  }
}

// ─── Dataset Compiler Sidecar (Port 8100) ───────────────────────────────────

export async function fetchDatasets(): Promise<DatasetItem[]> {
  try {
    const res = await fetch(`${DATASETS_BASE}/api/gui/datasets/with-stats`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.datasets || !Array.isArray(data.datasets)) return [];

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
      };
    });
  } catch {
    return [];
  }
}

export async function fetchCompilerPresets(): Promise<CompilerPreset[]> {
  try {
    const res = await fetch(`${DATASETS_BASE}/api/gui/presets`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.presets || [];
  } catch {
    return [];
  }
}

export async function triggerQuickCompile(payload: QuickCompilePayload): Promise<{ status: string; job_id?: string }> {
  const res = await fetch(`${DATASETS_BASE}/api/gui/quick-compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to trigger compilation: ${res.statusText}`);
  return res.json();
}

export async function triggerCustomCompile(payload: CustomCompilePayload): Promise<{ status: string; job_id?: string }> {
  const res = await fetch(`${DATASETS_BASE}/api/gui/custom-compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to trigger custom compilation: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchKaggleStatus(): Promise<KaggleStatusResponse> {
  try {
    const res = await fetch(`${DATASETS_BASE}/api/kaggle/status`);
    if (!res.ok) return { authenticated: false, auth_methods: { environment_variables: false, dot_kaggle_token: false, user_kaggle_json: false } };
    return res.json();
  } catch {
    return { authenticated: false, auth_methods: { environment_variables: false, dot_kaggle_token: false, user_kaggle_json: false } };
  }
}

export async function fetchKaggleRegistryDatasets(): Promise<KaggleDatasetRegistryItem[]> {
  try {
    const res = await fetch(`${DATASETS_BASE}/api/kaggle/registry-datasets`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function downloadKaggleDataset(payload: KaggleDownloadPayload): Promise<{ status: string; job_id?: string }> {
  const res = await fetch(`${DATASETS_BASE}/api/kaggle/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to trigger Kaggle download: ${res.statusText}`);
  }
  return res.json();
}

export async function uploadKaggleDataset(payload: KaggleUploadPayload): Promise<{ status: string; job_id?: string }> {
  const res = await fetch(`${DATASETS_BASE}/api/kaggle/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to trigger Kaggle upload: ${res.statusText}`);
  }
  return res.json();
}

// ─── Training Suite Sidecar (Port 8200) ─────────────────────────────────────

interface RawModelData {
  key?: string;
  model_key?: string;
  name?: string;
  display_name?: string;
  category?: string;
  task_type?: string;
  architecture?: string;
  architecture_type?: string;
  class_name?: string;
  canonical_format?: string;
  parameters_m?: number;
  best_checkpoint_size_mb?: number | null;
  spatial_ladder?: number[];
  resolution?: number | number[] | null;
  checkpoint_exists?: boolean;
  has_best_checkpoint?: boolean;
  checkpoints_count?: number;
  preferred_parallel?: "single" | "dp" | "ddp";
  epochs_completed?: number;
  latest_checkpoint_epoch?: number | null;
  ladder_type?: "spatial" | "timeframe";
  is_forex?: boolean;
  ladder_passed?: boolean;
  max_res_completed?: number | null;
  target_res?: number | null;
  data_fraction_completed?: number;
  data_fraction_passed?: boolean;
  best_metric?: number;
  metric_name?: string;
  sota_target?: number;
  sota_reached?: boolean;
  sota_targets_total?: number;
  sota_targets_met?: number;
  sota_all_met?: boolean;
  sota_details?: import("./types").SotaMetricDetail[];
  training_status?: string;
  learning_rate?: number;
  batch_size?: number;
  default_epochs?: number;
}

export async function fetchModels(): Promise<ModelItem[]> {
  try {
    const res = await fetch(`${TRAINING_BASE}/api/gui/models/with-stats`);
    if (!res.ok) return [];
    const data = (await res.json()) as RawModelData[] | { models?: RawModelData[] };
    const rawList: RawModelData[] = Array.isArray(data) ? data : (data.models || []);
    return rawList.map((item) => {
      const isForex = item.is_forex ?? (item.key === "forex_predictor" || item.category === "forex" || item.task_type === "forex");
      const ladderType = item.ladder_type ?? (isForex ? "timeframe" : "spatial");
      const defaultLadder = isForex ? [1, 5, 15, 60, 240, 1440] : [256, 384, 512];
      const spatialLadder: number[] = Array.isArray(item.spatial_ladder) && item.spatial_ladder.length > 0
        ? item.spatial_ladder
        : Array.isArray(item.resolution)
        ? (item.resolution as number[])
        : typeof item.resolution === "number"
        ? [item.resolution]
        : defaultLadder;

      const modelKey = item.key || item.model_key || "";
      const displayName = item.display_name || item.name || modelKey;
      const arch = item.architecture || item.architecture_type || item.class_name || "PyTorch Architecture";
      const task = item.task_type || item.category || "general";
      const canonicalFmt = item.canonical_format || "webdataset";
      const paramsM = item.parameters_m ?? (item.best_checkpoint_size_mb ? Math.round(item.best_checkpoint_size_mb * 0.25 * 10) / 10 : undefined);
      const ckptExists = item.checkpoint_exists ?? (item.has_best_checkpoint === true || (item.checkpoints_count !== undefined && item.checkpoints_count > 0));
      const parallelMode = item.preferred_parallel || "single";
      const completedEpochs = item.epochs_completed ?? (item.latest_checkpoint_epoch ?? 0);
      const metricVal = item.best_metric;
      const metricLabel = item.metric_name || "Metric";
      const sotaTarget = item.sota_target;
      const sotaReached = item.sota_reached ?? false;
      const ladderPassed = item.ladder_passed ?? false;
      const dataFractionPassed = item.data_fraction_passed ?? false;
      const status = item.training_status || (
        (sotaReached && ladderPassed && dataFractionPassed)
          ? "fully_trained"
          : completedEpochs > 0
          ? "partially_trained"
          : ckptExists
          ? "weights_ready"
          : "initializing"
      );

      return {
        key: modelKey,
        display_name: displayName,
        architecture: arch,
        task_type: task,
        category: item.category,
        canonical_format: canonicalFmt,
        parameters_m: paramsM,
        spatial_ladder: spatialLadder,
        ladder_type: ladderType,
        is_forex: isForex,
        ladder_passed: ladderPassed,
        max_res_completed: item.max_res_completed ?? null,
        target_res: item.target_res ?? (spatialLadder.length > 0 ? spatialLadder[spatialLadder.length - 1] : null),
        data_fraction_completed: item.data_fraction_completed ?? 0,
        data_fraction_passed: dataFractionPassed,
        checkpoint_exists: ckptExists,
        preferred_parallel: parallelMode,
        epochs_completed: completedEpochs,
        best_metric: metricVal,
        metric_name: metricLabel,
        sota_target: sotaTarget,
        sota_reached: sotaReached,
        sota_targets_total: item.sota_targets_total,
        sota_targets_met: item.sota_targets_met,
        sota_all_met: item.sota_all_met,
        sota_details: item.sota_details,
        training_status: status,
        learning_rate: typeof item.learning_rate === "number" ? item.learning_rate : undefined,
        batch_size: typeof item.batch_size === "number" ? item.batch_size : undefined,
        default_epochs: typeof item.default_epochs === "number" ? item.default_epochs : undefined,
      };
    });
  } catch {
    return [];
  }
}

export async function triggerQuickTrain(payload: QuickTrainPayload): Promise<{ status: string; job_id?: string }> {
  const res = await fetch(`${TRAINING_BASE}/api/gui/quick-train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to trigger training: ${res.statusText}`);
  return res.json();
}

// ─── Real-Time WebSocket Streaming ──────────────────────────────────────────

export function createLogWebSocket(
  onEvent: (event: PipelineEvent) => void,
  onStatusChange: (connected: boolean) => void
): () => void {
  let ws: WebSocket | null = null;
  let retryTimer: number | null = null;
  let active = true;

  function connect() {
    if (!active) return;
    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        onStatusChange(true);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.step_name) {
            onEvent(parsed as PipelineEvent);
          }
        } catch {
          // Ignore non-JSON ping
        }
      };

      ws.onclose = () => {
        onStatusChange(false);
        if (active) {
          retryTimer = window.setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws?.close();
      };
    } catch {
      onStatusChange(false);
      if (active) {
        retryTimer = window.setTimeout(connect, 3000);
      }
    }
  }

  connect();

  return () => {
    active = false;
    if (retryTimer) clearTimeout(retryTimer);
    if (ws) ws.close();
  };
}
