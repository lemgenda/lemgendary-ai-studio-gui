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
  KaggleKernelItem,
  KaggleMonitorPayload,
  KaggleStatusResponse,
  KaggleSuiteStatus,
  KaggleTrainPayload,
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
  TrainingJobInfo,
} from "./types";

export type { KaggleKernelItem, KaggleMonitorPayload, KaggleSuiteStatus, KaggleTrainPayload, MeshStatus, ServiceOperationResult, TrainingJobInfo };

export const ENV_BASE = "http://127.0.0.1:8000";
export const DATASETS_BASE = "http://127.0.0.1:8100";
export const TRAINING_BASE = "http://127.0.0.1:8200";

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

export async function triggerPipelineStep(
  stepNumber: number,
  targetProject?: string,
  clean?: boolean
): Promise<{ status: string; message?: string }> {
  const res = await fetch(`${ENV_BASE}/api/pipeline/run-step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      step_number: stepNumber,
      target_project: targetProject || null,
      clean: Boolean(clean),
    }),
  });
  if (!res.ok) throw new Error(`Failed to trigger pipeline step ${stepNumber}: ${res.statusText}`);
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

export async function startDevService(serviceId: string): Promise<ServiceOperationResult> {
  const res = await fetch("/api/dev/services/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serviceId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || `Failed to start ${serviceId}: ${res.statusText}`);
  }
  return res.json();
}

export async function startDevAllServices(): Promise<{ results: Record<string, ServiceOperationResult> }> {
  const res = await fetch("/api/dev/services/start-all", {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || `Failed to start all services: ${res.statusText}`);
  }
  return res.json();
}

export async function startService(serviceId: string): Promise<ServiceOperationResult> {
  const isTauri =
    typeof window !== "undefined" &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("spawn_service", { serviceId });
    return {
      status: "started",
      message: `Started ${serviceId} background daemon.`,
      port: serviceId === "env-manager" ? 8000 : serviceId === "dataset-compiler" ? 8100 : 8200,
    };
  }

  if (serviceId === "env-manager") {
    return startDevService(serviceId);
  }
  try {
    const res = await fetch(`${ENV_BASE}/api/services/${serviceId}/start`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to start ${serviceId}: ${res.statusText}`);
    }
    return res.json();
  } catch {
    // If Environment Manager port 8000 is unreachable, fall back to dev server endpoint
    return startDevService(serviceId);
  }
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
  const isTauri =
    typeof window !== "undefined" &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("spawn_all_services");
    return { results: {} };
  }

  try {
    const res = await fetch(`${ENV_BASE}/api/services/start-all`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to start all services: ${res.statusText}`);
    }
    return res.json();
  } catch {
    // Fall back to dev server endpoint if root coordinator is offline
    return startDevAllServices();
  }
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
        task: item.task || "vision",
        sources: item.sources || [],
        kaggle_ref: item.kaggle_ref,
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

export interface KaggleMetadataPayload {
  manifold?: string;
  kaggle_ref?: string;
  all_datasets?: boolean;
}

export async function updateKaggleMetadata(payload: KaggleMetadataPayload): Promise<{ status: string; job_id?: string }> {
  const res = await fetch(`${DATASETS_BASE}/api/kaggle/update-metadata`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to trigger metadata update: ${res.statusText}`);
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
  active_res?: number | null;
  max_res_completed?: number | null;
  target_res?: number | null;
  active_data_fraction?: number | null;
  data_fraction_completed?: number;
  data_fraction_passed?: boolean;
  kaggle_ref?: string;
  kaggle_dataset_urls?: string[];
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

export async function fetchLiveModelTelemetry(modelKey: string): Promise<{ latest_res?: number | null; latest_data?: number | null; latest_epoch?: number | null } | null> {
  try {
    const res = await fetch(`/api/model-telemetry/${encodeURIComponent(modelKey)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchModels(): Promise<ModelItem[]> {
  try {
    const res = await fetch(`${TRAINING_BASE}/api/gui/models/with-stats`);
    if (!res.ok) return [];
    const data = (await res.json()) as RawModelData[] | { models?: RawModelData[] };
    const rawList: RawModelData[] = Array.isArray(data) ? data : (data.models || []);

    const enrichedList = await Promise.all(
      rawList.map(async (item) => {
        const modelKey = item.key || item.model_key || "";
        const liveTel = modelKey ? await fetchLiveModelTelemetry(modelKey).catch(() => null) : null;
        return { item, liveTel };
      })
    );

    return enrichedList.map(({ item, liveTel }) => {
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
      const completedEpochs = Math.max(item.epochs_completed ?? (item.latest_checkpoint_epoch ?? 0), liveTel?.latest_epoch ?? 0);
      const metricVal = item.best_metric;
      const metricLabel = item.metric_name || "Metric";
      const sotaTarget = item.sota_target;
      const sotaReached = item.sota_reached ?? false;
      const targetRes = item.target_res ?? (spatialLadder.length > 0 ? spatialLadder[spatialLadder.length - 1] : null);

      const activeRes = liveTel?.latest_res ?? item.active_res ?? item.max_res_completed ?? (spatialLadder.length > 0 ? spatialLadder[0] : (item.target_res ?? 512));
      const ladderPassed = item.ladder_passed ?? (targetRes !== null && typeof activeRes === "number" && activeRes >= targetRes);

      const dataFractionCompleted = typeof liveTel?.latest_data === "number"
        ? liveTel.latest_data
        : (typeof item.data_fraction_completed === "number" ? item.data_fraction_completed : 0);

      // Data fraction is only passed if current rung >= 99% AND ladder is passed (or SOTA reached with checkpoint)
      const dataFractionPassed = (dataFractionCompleted >= 0.99 && ladderPassed) || (sotaReached && ckptExists);

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
        active_res: activeRes,
        max_res_completed: item.max_res_completed ?? null,
        target_res: targetRes,
        active_data_fraction: item.active_data_fraction ?? null,
        data_fraction_completed: dataFractionCompleted,
        data_fraction_passed: dataFractionPassed,
        kaggle_ref: item.kaggle_ref,
        kaggle_dataset_urls: item.kaggle_dataset_urls,
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

export async function fetchRunningTrainingJobs(): Promise<TrainingJobInfo[]> {
  try {
    const res = await fetch(`${TRAINING_BASE}/api/jobs?status=running`);
    if (!res.ok) return [];
    return (await res.json()) as TrainingJobInfo[];
  } catch {
    return [];
  }
}

export async function cancelTrainingJob(jobId: string): Promise<boolean> {
  try {
    const res = await fetch(`${TRAINING_BASE}/api/jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: "POST",
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.cancelled || data.status === "cancelled");
  } catch {
    return false;
  }
}

// ─── Kaggle Cloud Engine Orchestration (Port 8200) ───────────────────────────

export async function fetchKaggleSuiteStatus(): Promise<KaggleSuiteStatus> {
  try {
    const res = await fetch(`${TRAINING_BASE}/api/training/kaggle/status`);
    if (!res.ok) return { authenticated: false, username: "", token_configured: false };
    return res.json();
  } catch {
    return { authenticated: false, username: "", token_configured: false };
  }
}

export async function fetchKaggleKernels(limit: number = 20): Promise<KaggleKernelItem[]> {
  try {
    const res = await fetch(`${TRAINING_BASE}/api/training/kaggle/kernels?limit=${limit}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function launchKaggleTrain(payload: KaggleTrainPayload): Promise<{ job_id: string; status: string; message: string; model: string }> {
  const res = await fetch(`${TRAINING_BASE}/api/training/kaggle/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Failed to launch Kaggle training: ${res.statusText}`);
  }
  return res.json();
}

export async function monitorKaggleKernel(payload: KaggleMonitorPayload): Promise<{ job_id: string; status: string; message: string; kernel_slug: string }> {
  const res = await fetch(`${TRAINING_BASE}/api/training/kaggle/monitor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Failed to connect to Kaggle kernel: ${res.statusText}`);
  }
  return res.json();
}

export async function pullKaggleModelArtifacts(model: string): Promise<{ status: string; model: string; message: string }> {
  const res = await fetch(`${TRAINING_BASE}/api/training/kaggle/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Failed to pull Kaggle artifacts: ${res.statusText}`);
  }
  return res.json();
}

export async function pushKaggleModelArtifacts(model: string): Promise<{ status: string; model: string; message: string }> {
  const res = await fetch(`${TRAINING_BASE}/api/training/kaggle/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Failed to push Kaggle artifacts: ${res.statusText}`);
  }
  return res.json();
}

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
  const res = await fetch(`${TRAINING_BASE}/api/notebooks/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Failed to generate notebooks: ${res.statusText}`);
  }
  return res.json();
}

// ─── Real-Time WebSocket Streaming ──────────────────────────────────────────

const MESH_WEBSOCKET_URLS = [
  { id: "env-manager", url: "ws://127.0.0.1:8000/ws/log", defaultStep: "EnvManager" },
  { id: "training-suite", url: "ws://127.0.0.1:8200/api/ws/logs", defaultStep: "Training" },
  { id: "dataset-compiler", url: "ws://127.0.0.1:8100/api/ws/events", defaultStep: "Compiler" },
];

export function cleanAnsiAndControlChars(text: string): string {
  if (!text) return "";
  // If text contains carriage return(s), take the latest line segment
  if (text.includes("\r")) {
    const segments = text.split("\r").map((s) => s.trim()).filter(Boolean);
    if (segments.length > 0) {
      text = segments[segments.length - 1];
    }
  }
  // Strip ANSI escape sequences (\x1b[...] or \u001b[...)
  // eslint-disable-next-line no-control-regex
  let cleaned = text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
  // Strip leftover control characters like leading [K or cursor controls with parameter numbers (e.g. [2K, [0m)
  // Require at least one digit or semicolon so bracketed tags like [PROGRESS] or [GOVERNOR] are never truncated
  cleaned = cleaned
    .replace(/^\s*\[K\s*/, "")
    .replace(/^\[[0-9;]+[a-zA-Z]/, "")
    .replace(/^\[\?[0-9]+[a-zA-Z]/, "");
  return cleaned.trim();
}

export function isProgressLine(msg: string): boolean {
  if (!msg) return false;
  // Progress bar glyphs (e.g. 92% ──────── or ████ or |===|)
  const hasBar = /[\u2580-\u259F\u2500-\u257F━█─\-=]{3,}/.test(msg) && /\d+%/.test(msg);
  // Iteration rate indicators (e.g. 7875/8479 3.7it/s or 500/1000 [00:10<00:05, 10.2it/s])
  const hasRate = /\b\d+\/\d+\b\s+.*\b(it\/s|s\/it|B\/s|KB\/s|MB\/s|GB\/s)\b/.test(msg);
  // Estimated completion timer pattern (e.g. 48:05<2:43 or 00:01<00:00)
  const hasEta = /\d+:\d+<\d+:\d+/.test(msg);
  // Classic tqdm formatting: 92%|████████  | 7875/8479
  const hasTqdm = /\d+%\s*\|.*\|\s*\d+\/\d+/.test(msg);
  return hasBar || hasRate || hasEta || hasTqdm;
}

function normalizeSocketMessage(data: unknown, defaultStep: string): PipelineEvent | null {
  if (!data || typeof data !== "object") return null;

  const raw = data as Record<string, unknown>;

  // 1. Native PipelineEvent from env-manager
  if (typeof raw.step_name === "string" && typeof raw.message === "string") {
    const cleanMsg = cleanAnsiAndControlChars(raw.message);
    const isProgress = Boolean(raw.is_progress || isProgressLine(cleanMsg));
    const rawStatus = String(raw.status || "info").toLowerCase();
    const status: PipelineEvent["status"] =
      rawStatus === "success" || rawStatus === "warning" || rawStatus === "error"
        ? rawStatus
        : "info";

    return {
      step_number: typeof raw.step_number === "number" ? raw.step_number : 0,
      total_steps: typeof raw.total_steps === "number" ? raw.total_steps : 1,
      step_name: raw.step_name,
      status,
      message: cleanMsg,
      is_progress: isProgress,
      timestamp: typeof raw.timestamp === "string" ? raw.timestamp : new Date().toISOString(),
      data: (raw.data as Record<string, unknown>) || undefined,
    };
  }

  // 2. Training Suite daemon broadcast ({"job_id": ..., "message": ...})
  if (typeof raw.message === "string") {
    const cleanMsg = cleanAnsiAndControlChars(raw.message);
    const isProgress = Boolean(raw.is_progress || isProgressLine(cleanMsg));
    let status: PipelineEvent["status"] = "info";
    const msgLower = cleanMsg.toLowerCase();
    if (msgLower.includes("[error]") || msgLower.includes("failed") || msgLower.includes("exception")) {
      status = "error";
    } else if (msgLower.includes("[success]") || msgLower.includes("complete")) {
      status = "success";
    } else if (msgLower.includes("[warn")) {
      status = "warning";
    }

    return {
      step_number: 0,
      total_steps: 1,
      step_name: typeof raw.step_name === "string" ? raw.step_name : defaultStep,
      status,
      message: cleanMsg,
      is_progress: isProgress,
      timestamp: typeof raw.timestamp === "string" ? raw.timestamp : new Date().toISOString(),
      data: raw.job_id || raw.job_type ? { job_id: raw.job_id, job_type: raw.job_type } : undefined,
    };
  }

  // 3. Dataset Compiler chunk broadcast ({"chunk": ...})
  if (typeof raw.chunk === "string") {
    const cleanMsg = cleanAnsiAndControlChars(raw.chunk);
    const isProgress = Boolean(isProgressLine(cleanMsg));
    return {
      step_number: 0,
      total_steps: 1,
      step_name: defaultStep,
      status: "info",
      message: cleanMsg,
      is_progress: isProgress,
      timestamp: new Date().toISOString(),
    };
  }

  return null;
}

export function createLogWebSocket(
  onEvent: (event: PipelineEvent) => void,
  onStatusChange: (connected: boolean) => void
): () => void {
  let active = true;
  const sockets = new Map<string, WebSocket>();
  const retryTimers = new Map<string, number>();
  const connectionStates = new Map<string, boolean>();

  const updateAggregatedStatus = () => {
    const isAnyConnected = Array.from(connectionStates.values()).some(Boolean);
    onStatusChange(isAnyConnected);
  };

  const connectEndpoint = (endpoint: (typeof MESH_WEBSOCKET_URLS)[number]) => {
    if (!active) return;

    try {
      const ws = new WebSocket(endpoint.url);
      sockets.set(endpoint.id, ws);

      ws.onopen = () => {
        connectionStates.set(endpoint.id, true);
        updateAggregatedStatus();
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const normalized = normalizeSocketMessage(parsed, endpoint.defaultStep);
          if (normalized) {
            onEvent(normalized);
          }
        } catch {
          // Ignore non-JSON heartbeat
        }
      };

      ws.onclose = () => {
        connectionStates.set(endpoint.id, false);
        updateAggregatedStatus();
        if (active) {
          const timer = window.setTimeout(() => connectEndpoint(endpoint), 3000);
          retryTimers.set(endpoint.id, timer);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      connectionStates.set(endpoint.id, false);
      updateAggregatedStatus();
      if (active) {
        const timer = window.setTimeout(() => connectEndpoint(endpoint), 3000);
        retryTimers.set(endpoint.id, timer);
      }
    }
  };

  for (const ep of MESH_WEBSOCKET_URLS) {
    connectEndpoint(ep);
  }

  return () => {
    active = false;
    for (const timer of retryTimers.values()) {
      clearTimeout(timer);
    }
    retryTimers.clear();
    for (const ws of sockets.values()) {
      ws.close();
    }
    sockets.clear();
  };
}
