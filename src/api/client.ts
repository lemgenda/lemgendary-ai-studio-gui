/**
 * LemGendary AI Studio - Tripartite Multi-Sidecar API Client
 */

import {
  BackendDatasetStats,
  CompilerPreset,
  CompilerPresetListResponse,
  CustomCompilePayload,
  DatasetJobResponse,
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
  SecretDraft,
  SecretItem,
  SecretWriteItem,
  SecretsSaveResponse,
  ServiceOperationResult,
  TrainingJobInfo,
  DeepCleanResponse,
  HooksInstallResponse,
  ManifoldReducePayload,
  ModelEvalPayload,
  ModelExportPayload,
  ModernizationQueueItem,
  ModernizeRunPayload,
  RegenerateManifoldsResponse,
  UnitTestAllPayload,
  UnitTestSuitePayload,
  UnitTestSuiteResult,
  ModelVariationInfo,
  ModelDocGenResponse,
  ModelStageResponse,
  VariationValidationDetail,
  ModelValidateIsolationResponse,
  KagglePushModelPayload,
  KagglePushModelResponse,
  KagglePushAllPayload,
  KagglePushAllResponse,
  LLMTrainingConfig,
  LLMTrainResponse,
  BugReportResponse,
} from "./types";

export type {
  KaggleKernelItem,
  KaggleMonitorPayload,
  KaggleSuiteStatus,
  KaggleTrainPayload,
  MeshStatus,
  ServiceOperationResult,
  TrainingJobInfo,
  DeepCleanResponse,
  HooksInstallResponse,
  ManifoldReducePayload,
  ModelEvalPayload,
  ModelExportPayload,
  ModernizationQueueItem,
  ModernizeRunPayload,
  RegenerateManifoldsResponse,
  UnitTestAllPayload,
  UnitTestSuitePayload,
  UnitTestSuiteResult,
  ModelVariationInfo,
  ModelDocGenResponse,
  ModelStageResponse,
  VariationValidationDetail,
  ModelValidateIsolationResponse,
  KagglePushModelPayload,
  KagglePushModelResponse,
  KagglePushAllPayload,
  KagglePushAllResponse,
  LLMTrainingConfig,
  LLMTrainResponse,
};

import { MESH_SERVICES, ServiceId } from "./config";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { open as openWithShell } from "@tauri-apps/plugin-shell";
import { sidecarFetch } from "./http";
import { BugReportSubmitError, bugReportErrorFromResponse } from "../bugReport/serverErrors";
export { MESH_SERVICES };
export type { ServiceId };

export const ENV_BASE = MESH_SERVICES["env-manager"].httpUrl;
export const DATASETS_BASE = MESH_SERVICES["dataset-compiler"].httpUrl;
export const TRAINING_BASE = MESH_SERVICES["training-suite"].httpUrl;

// ─── Environment Manager (Port 8000) ─────────────────────────────────────────

export async function fetchHardware(): Promise<HardwareProfile> {
  const res = await sidecarFetch(`${ENV_BASE}/api/hardware`);
  if (!res.ok) throw new Error(`Failed to fetch hardware profile: ${res.statusText}`);
  return res.json();
}

export async function fetchHealth(): Promise<HealthAuditReport> {
  const res = await sidecarFetch(`${ENV_BASE}/api/health`);
  if (!res.ok) throw new Error(`Failed to fetch health report: ${res.statusText}`);
  return res.json();
}

export async function fetchProjects(): Promise<ProjectHealth[]> {
  const res = await sidecarFetch(`${ENV_BASE}/api/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.statusText}`);
  return res.json();
}

export async function fetchPipelineStatus(): Promise<PipelineStatus> {
  const res = await sidecarFetch(`${ENV_BASE}/api/pipeline/status`);
  if (!res.ok) throw new Error(`Failed to fetch pipeline status: ${res.statusText}`);
  return res.json();
}

export interface TriggerPipelineOptions {
  /** Destructive: deletes every venv and node_modules. Required so callers decide explicitly. */
  clean: boolean;
  targetProject?: string;
}

export async function triggerPipeline(
  options: TriggerPipelineOptions
): Promise<{ status: string; message?: string }> {
  const res = await sidecarFetch(`${ENV_BASE}/api/pipeline/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      target_project: options.targetProject || null,
      clean: options.clean,
    }),
  });
  if (!res.ok) throw new Error(`Failed to trigger pipeline: ${res.statusText}`);
  return res.json();
}

export async function triggerPipelineStep(
  stepNumber: number,
  clean: boolean,
  targetProject?: string
): Promise<{ status: string; message?: string }> {
  const res = await sidecarFetch(`${ENV_BASE}/api/pipeline/run-step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      step_number: stepNumber,
      target_project: targetProject || null,
      clean,
    }),
  });
  if (!res.ok) throw new Error(`Failed to trigger pipeline step ${stepNumber}: ${res.statusText}`);
  return res.json();
}


export async function fetchEcosystemMesh(): Promise<EcosystemSidecarMesh> {
  const res = await sidecarFetch(`${ENV_BASE}/api/gui/ecosystem`);
  if (!res.ok) throw new Error(`Failed to probe ecosystem mesh: ${res.statusText}`);
  return res.json();
}

/**
 * Lightweight reachability probe for a single sidecar port.
 * Uses a 1500 ms AbortController timeout so the UI never hangs waiting.
 * Falls back to false on any network error or timeout.
 */
export async function probeSidecarPort(target: number | ServiceId): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 2000);
  try {
    let url: string;
    if (typeof target === "string" && target in MESH_SERVICES) {
      const service = MESH_SERVICES[target];
      url = `${service.httpUrl}${service.livenessPath}`;
    } else {
      const match = Object.values(MESH_SERVICES).find((s) => s.defaultPort === target);
      url = match ? `${match.httpUrl}${match.livenessPath}` : `http://127.0.0.1:${target}/api/health`;
    }
    const res = await sidecarFetch(url, {
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

/** Raise an `Error` carrying the sidecar's `detail` (or status text) for a failed response. */
async function throwHttpError(res: Response, action: string): Promise<never> {
  let detail = "";
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === "string") detail = body.detail;
  } catch (parseErr) {
    console.warn(`${action}: error response body was not JSON`, parseErr);
  }
  throw new Error(detail || `${action} failed: HTTP ${res.status} ${res.statusText}`);
}

/** Tauri native command used when the Environment Manager cannot start services itself. */
async function invokeNativeSpawn(command: "spawn_service" | "spawn_all_services", args?: Record<string, unknown>): Promise<void> {
  if (!isTauri()) {
    throw new Error(
      "The Environment Manager is offline and this is a plain browser session, so services cannot be started from here. " +
        "Start the Environment Manager manually or use the LemGendary AI Studio desktop app."
    );
  }
  await invoke(command, args);
}

/**
 * Start one sidecar. The Environment Manager starts services when it is online;
 * when it is offline (or it is the service being started) the desktop app's
 * native `spawn_service` command is used instead.
 */
export async function startService(serviceId: string): Promise<ServiceOperationResult> {
  const envOnline = await probeSidecarPort("env-manager");
  if (serviceId === "env-manager" && envOnline) {
    return {
      status: "already_running",
      message: "Environment Manager is already online.",
      port: MESH_SERVICES["env-manager"].defaultPort,
    };
  }
  if (envOnline) {
    const res = await sidecarFetch(`${ENV_BASE}/api/services/${encodeURIComponent(serviceId)}/start`, {
      method: "POST",
    });
    if (!res.ok) return throwHttpError(res, `Start ${serviceId}`);
    return res.json();
  }
  await invokeNativeSpawn("spawn_service", { serviceId });
  return {
    status: "started",
    message: `Spawned ${serviceId} via the desktop app.`,
    port: MESH_SERVICES[serviceId as ServiceId]?.defaultPort,
  };
}

export async function stopService(serviceId: string): Promise<ServiceOperationResult> {
  const res = await sidecarFetch(`${ENV_BASE}/api/services/${encodeURIComponent(serviceId)}/stop`, {
    method: "POST",
  });
  if (!res.ok) return throwHttpError(res, `Stop ${serviceId}`);
  return res.json();
}

/**
 * Start every offline sidecar: through the Environment Manager when it is
 * online, otherwise through the desktop app's native `spawn_all_services`.
 */
export async function startAllServices(): Promise<{ results: Record<string, ServiceOperationResult> }> {
  if (await probeSidecarPort("env-manager")) {
    const res = await sidecarFetch(`${ENV_BASE}/api/services/start-all`, {
      method: "POST",
    });
    if (!res.ok) return throwHttpError(res, "Start all services");
    return res.json();
  }
  await invokeNativeSpawn("spawn_all_services");
  return { results: {} };
}

export interface SafeUpdateResponse {
  /** "accepted" (background job started), "dry_run" or "up_to_date". */
  status: string;
  message?: string;
  job_id?: string;
  project?: string | null;
  events?: unknown[];
  plan?: unknown;
}

/**
 * Start a safe package update. A real run returns at once with a job id;
 * progress arrives over the env-manager WebSocket. 409 means an update or the
 * pipeline is already running.
 */
export async function triggerSafeUpdate(
  dryRun: boolean = false,
  project?: string
): Promise<SafeUpdateResponse> {
  const resp = await sidecarFetch(`${ENV_BASE}/api/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dry_run: dryRun, project: project ?? null }),
  });
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { detail?: unknown };
    const detail = typeof err.detail === "string" ? err.detail : resp.statusText;
    throw new Error(`Safe package update failed (${resp.status}): ${detail}`);
  }
  return resp.json();
}

export async function triggerDeepClean(project?: string): Promise<DeepCleanResponse> {
  const resp = await sidecarFetch(`${ENV_BASE}/api/clean`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project }),
  });
  if (!resp.ok) {
    throw new Error(`Deep cache clean failed: ${resp.status}`);
  }
  return resp.json();
}

export async function installGitHooks(project?: string): Promise<HooksInstallResponse> {
  const resp = await sidecarFetch(`${ENV_BASE}/api/hooks/install`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project }),
  });
  if (!resp.ok) {
    throw new Error(`Git hooks installation failed: ${resp.status}`);
  }
  return resp.json();
}

export async function runEcosystemValidation(project?: string): Promise<{ status: string; all_passed: boolean; projects: Record<string, unknown> }> {
  const resp = await sidecarFetch(`${ENV_BASE}/api/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project }),
  });
  if (!resp.ok) {
    throw new Error(`Ecosystem validation failed: ${resp.status}`);
  }
  return resp.json();
}


// ─── Universal Manifest & Registry Editor (Port 8000) ───────────────────────

export async function fetchManifestRegistry(): Promise<ManifestItem[]> {
  const res = await sidecarFetch(`${ENV_BASE}/api/manifests/registry`);
  if (!res.ok) throw new Error(`Failed to fetch manifest registry: ${res.statusText}`);
  const data = await res.json();
  return data.manifests || [];
}

export async function readManifest(name: string): Promise<ManifestReadResponse> {
  const res = await sidecarFetch(`${ENV_BASE}/api/manifests/read?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Failed to read manifest '${name}': ${res.statusText}`);
  return res.json();
}

export async function validateManifest(name: string, content: string): Promise<ManifestValidateResponse> {
  const res = await sidecarFetch(`${ENV_BASE}/api/manifests/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, content }),
  });
  if (!res.ok) throw new Error(`Failed to validate manifest: ${res.statusText}`);
  return res.json();
}

export async function saveManifest(name: string, content: string): Promise<ManifestSaveResponse> {
  const res = await sidecarFetch(`${ENV_BASE}/api/manifests/save`, {
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
    const res = await sidecarFetch(`${ENV_BASE}/api/secrets`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.secrets || [];
  } catch {
    return [];
  }
}

/**
 * Convert editor drafts to the write-only payload. Masking fields are dropped
 * and an empty `secret_value` tells the server to keep the stored value.
 */
export function toSecretWriteItems(drafts: SecretDraft[]): SecretWriteItem[] {
  return drafts.map((d) => ({
    id: d.id,
    service: d.service,
    label: d.label,
    username: d.username ?? null,
    server: d.server ?? null,
    is_default: Boolean(d.is_default),
    created_at: d.created_at ?? null,
    secret_value: (d.secret_value ?? "").trim(),
  }));
}

export async function saveSecrets(drafts: SecretDraft[]): Promise<SecretsSaveResponse> {
  const res = await sidecarFetch(`${ENV_BASE}/api/secrets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secrets: toSecretWriteItems(drafts) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to save secrets: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Offline documentation hub status from the Environment Manager, which also
 * serves the hub at `local_url`. Throws when the Environment Manager is unreachable.
 */
export async function fetchDocsStatus(): Promise<DocsStatusResponse> {
  const res = await sidecarFetch(`${ENV_BASE}/api/docs/status`);
  if (!res.ok) return throwHttpError(res, "Documentation hub status");
  return res.json();
}

/** Open an external URL: the system browser in the desktop app, a new tab in a browser session. */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    await openWithShell(url);
    return;
  }
  const opened = window.open(url, "_blank");
  if (opened === null) {
    throw new Error(`The browser blocked opening ${url}`);
  }
  opened.opener = null;
}

/**
 * Send a bug report (`POST /api/bug-report`, multipart) to the Environment
 * Manager, which saves the ZIP and opens the mail client.
 * Throws `BugReportSubmitError`: `offline` when the Environment Manager cannot
 * be reached, `validation` (422, with field errors), `too_large` (413) or `server`.
 */
export async function submitBugReport(form: FormData): Promise<BugReportResponse> {
  let res: Response;
  try {
    res = await sidecarFetch(`${ENV_BASE}/api/bug-report`, { method: "POST", body: form });
  } catch (err: unknown) {
    throw BugReportSubmitError.offline(err);
  }
  if (!res.ok) {
    const body: unknown = await res.json().catch((parseError: unknown) => {
      console.warn("Bug report error response is not JSON:", parseError);
      return null;
    });
    throw bugReportErrorFromResponse(res.status, res.statusText, body);
  }
  return (await res.json()) as BugReportResponse;
}

// ─── Dataset Compiler Sidecar (Port 8100) ───────────────────────────────────

export async function fetchDatasets(): Promise<DatasetItem[]> {
  try {
    const res = await sidecarFetch(`${DATASETS_BASE}/api/gui/datasets/with-stats`);
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

/**
 * Readable message from a sidecar error body: FastAPI `detail` is either a
 * string (HTTPException) or a list of `{loc, msg}` entries (422 validation).
 */
export function sidecarErrorDetail(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) return fallback;
  const { detail, message } = body as { detail?: unknown; message?: unknown };
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((entry: unknown) => {
        if (typeof entry !== "object" || entry === null) return String(entry);
        const { loc, msg } = entry as { loc?: unknown; msg?: unknown };
        const where = Array.isArray(loc) ? loc.filter((p) => p !== "body").join(".") : "";
        return where ? `${where}: ${String(msg)}` : String(msg);
      })
      .filter((part) => part.length > 0);
    if (parts.length > 0) return parts.join("; ");
  }
  if (typeof message === "string" && message) return message;
  return fallback;
}

/** POST JSON to the Dataset Compiler and return the parsed body; throws with the server's detail on HTTP errors. */
async function postDatasetJson<T>(path: string, payload: unknown, action: string): Promise<T> {
  const res = await sidecarFetch(`${DATASETS_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw new Error(sidecarErrorDetail(body, `${action} failed: HTTP ${res.status} ${res.statusText}`.trim()));
  }
  return (await res.json()) as T;
}

/**
 * Compiler presets from `presets.yaml` (`GET /api/gui/presets`), sorted by name.
 * The server returns a dict keyed by preset name; throws when the sidecar is unreachable or answers with an error.
 */
export async function fetchCompilerPresets(): Promise<CompilerPreset[]> {
  const res = await sidecarFetch(`${DATASETS_BASE}/api/gui/presets`);
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw new Error(sidecarErrorDetail(body, `Preset request failed: HTTP ${res.status} ${res.statusText}`.trim()));
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
  return postDatasetJson<DatasetJobResponse>("/api/gui/quick-compile", payload, "Compilation request");
}

export async function triggerCustomCompile(payload: CustomCompilePayload): Promise<DatasetJobResponse> {
  return postDatasetJson<DatasetJobResponse>("/api/gui/custom-compile", payload, "Custom compilation request");
}

export async function fetchKaggleStatus(): Promise<KaggleStatusResponse> {
  try {
    const res = await sidecarFetch(`${DATASETS_BASE}/api/kaggle/status`);
    if (!res.ok) return { authenticated: false, auth_methods: { environment_variables: false, dot_kaggle_token: false, user_kaggle_json: false } };
    return res.json();
  } catch {
    return { authenticated: false, auth_methods: { environment_variables: false, dot_kaggle_token: false, user_kaggle_json: false } };
  }
}

export async function fetchKaggleRegistryDatasets(): Promise<KaggleDatasetRegistryItem[]> {
  try {
    const res = await sidecarFetch(`${DATASETS_BASE}/api/kaggle/registry-datasets`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function downloadKaggleDataset(payload: KaggleDownloadPayload): Promise<DatasetJobResponse> {
  return postDatasetJson<DatasetJobResponse>("/api/kaggle/download", payload, "Kaggle download request");
}

export async function uploadKaggleDataset(payload: KaggleUploadPayload): Promise<DatasetJobResponse> {
  return postDatasetJson<DatasetJobResponse>("/api/kaggle/upload", payload, "Kaggle upload request");
}

export interface KaggleMetadataPayload {
  manifold?: string;
  kaggle_ref?: string;
  all_datasets?: boolean;
}

export async function updateKaggleMetadata(payload: KaggleMetadataPayload): Promise<DatasetJobResponse> {
  return postDatasetJson<DatasetJobResponse>("/api/kaggle/update-metadata", payload, "Kaggle metadata update");
}

export async function updateAllKaggleMetadata(): Promise<DatasetJobResponse> {
  return updateKaggleMetadata({ all_datasets: true });
}

/** `GET /api/modernize/queue` returns a bare list of queue items. */
export async function fetchModernizationQueue(): Promise<ModernizationQueueItem[]> {
  const resp = await sidecarFetch(`${DATASETS_BASE}/api/modernize/queue`);
  if (!resp.ok) {
    const body: unknown = await resp.json().catch(() => null);
    throw new Error(sidecarErrorDetail(body, `Failed to fetch modernization queue: HTTP ${resp.status}`));
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
  return postDatasetJson<DatasetJobResponse>("/api/modernize/run", payload, "Modernization run");
}

export async function triggerManifoldReduce(payload: ManifoldReducePayload): Promise<DatasetJobResponse> {
  return postDatasetJson<DatasetJobResponse>("/api/modernize/reduce", payload, "Manifold scale reduction");
}

export async function triggerRegenerateManifolds(): Promise<RegenerateManifoldsResponse> {
  return postDatasetJson<RegenerateManifoldsResponse>("/api/modernize/regenerate-manifolds", undefined, "Regenerate manifolds");
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
  ladder_type?: "spatial" | "timeframe" | "context_tokens";
  is_forex?: boolean;
  is_llm?: boolean;
  ladder_passed?: boolean;
  active_res?: number | null;
  max_res_completed?: number | null;
  target_res?: number | null;
  active_fold?: number | null;
  total_folds?: number | null;
  fold_years_label?: string | null;
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
  best_metrics_details?: import("./types").BestMetricDetail[];
  is_fully_trained?: boolean;
  training_status?: string;
  learning_rate?: number;
  batch_size?: number;
  default_epochs?: number;
}

export async function fetchModels(): Promise<ModelItem[]> {
  try {
    const res = await sidecarFetch(`${TRAINING_BASE}/api/gui/models/with-stats`);
    if (!res.ok) return [];
    const data = (await res.json()) as RawModelData[] | { models?: RawModelData[] };
    const rawList: RawModelData[] = Array.isArray(data) ? data : (data.models || []);

    // `with-stats` already carries the live metrics.csv telemetry (active_res,
    // data_fraction_completed, epochs_completed) for every model: one request, no N+1.
    return rawList.map((item) => {
      const modelKey = item.key || item.model_key || "";
      const isForex = item.is_forex ?? (modelKey === "forex_predictor" || item.category === "forex" || item.task_type === "forex");
      const isLlm = item.is_llm ?? (modelKey === "ai_helper_lemgend" || item.category === "llm" || item.task_type === "llm" || item.task_type === "text_instruction");
      const ladderType = item.ladder_type ?? (isForex ? "timeframe" : isLlm ? "context_tokens" : "spatial");
      const spatialLadder: number[] = Array.isArray(item.spatial_ladder) && item.spatial_ladder.length > 0
        ? item.spatial_ladder
        : Array.isArray(item.resolution)
        ? (item.resolution as number[])
        : typeof item.resolution === "number"
        ? [item.resolution]
        : []; // ladder comes from the sidecar only; empty means unknown

      const displayName = item.display_name || item.name || modelKey;
      const arch = item.architecture || item.architecture_type || item.class_name || "PyTorch Architecture";
      const task = item.task_type || item.category || "general";
      const canonicalFmt = item.canonical_format || "webdataset";
      const paramsM = item.parameters_m ?? (item.best_checkpoint_size_mb ? Math.round(item.best_checkpoint_size_mb * 0.25 * 10) / 10 : undefined);
      const ckptExists = item.checkpoint_exists ?? (item.has_best_checkpoint === true || (item.checkpoints_count !== undefined && item.checkpoints_count > 0));
      const parallelMode = item.preferred_parallel || "single";
      const completedEpochs = item.epochs_completed ?? item.latest_checkpoint_epoch ?? 0;
      const metricVal = item.best_metric;
      const metricLabel = item.metric_name || "Metric";
      const sotaTarget = item.sota_target;
      const sotaReached = item.sota_reached ?? false;
      const targetRes = item.target_res ?? (spatialLadder.length > 0 ? spatialLadder[spatialLadder.length - 1] : null);

      const activeRes = item.active_res ?? item.max_res_completed ?? (spatialLadder.length > 0 ? spatialLadder[0] : null);
      const ladderPassed = item.ladder_passed ?? (targetRes !== null && typeof activeRes === "number" && activeRes >= targetRes);

      const dataFractionCompleted = typeof item.data_fraction_completed === "number" ? item.data_fraction_completed : 0;

      // Data fraction is only passed if current rung >= 99% AND ladder is passed (or SOTA reached with checkpoint)
      const dataFractionPassed = item.data_fraction_passed ?? ((dataFractionCompleted >= 0.99 && ladderPassed) || (sotaReached && ckptExists));
      const isFullyTrained = item.is_fully_trained ?? (completedEpochs >= 20 && sotaReached && ladderPassed && dataFractionPassed);

      const status = item.training_status || (
        isFullyTrained
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
        is_llm: isLlm,
        ladder_passed: ladderPassed,
        active_res: activeRes,
        max_res_completed: item.max_res_completed ?? null,
        target_res: targetRes,
        active_fold: item.active_fold ?? null,
        total_folds: item.total_folds ?? null,
        fold_years_label: item.fold_years_label ?? null,
        active_data_fraction: item.active_data_fraction ?? null,
        data_fraction_completed: dataFractionCompleted,
        data_fraction_passed: dataFractionPassed,
        kaggle_ref: item.kaggle_ref,
        kaggle_dataset_urls: item.kaggle_dataset_urls,
        checkpoint_exists: ckptExists,
        is_fully_trained: isFullyTrained,
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
        best_metrics_details: item.best_metrics_details,
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
    if (!res.ok) return [];
    return (await res.json()) as TrainingJobInfo[];
  } catch {
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Cancel request failed: HTTP ${res.status} ${res.statusText}`);
  }
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Job status request failed: HTTP ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as TrainingJobInfo;
}

// ─── Kaggle Cloud Engine Orchestration (Port 8200) ───────────────────────────

export async function fetchKaggleSuiteStatus(): Promise<KaggleSuiteStatus> {
  try {
    const [res, secrets] = await Promise.all([
      sidecarFetch(`${TRAINING_BASE}/api/training/kaggle/status`).catch(() => null),
      fetchSecrets().catch(() => []),
    ]);

    const defaultKaggle = (secrets || []).find(
      (s) => s.service.toLowerCase() === "kaggle" && s.is_default
    );

    const data: KaggleSuiteStatus =
      res && res.ok
        ? await res.json()
        : { authenticated: false, username: "", token_configured: false };

    if (defaultKaggle && defaultKaggle.username) {
      data.username = defaultKaggle.username;
      data.token_configured = defaultKaggle.has_value;
      if (defaultKaggle.has_value) {
        data.authenticated = true;
      }
    }
    return data;
  } catch {
    return { authenticated: false, username: "", token_configured: false };
  }
}

export async function fetchKaggleKernels(limit: number = 20): Promise<KaggleKernelItem[]> {
  try {
    const res = await sidecarFetch(`${TRAINING_BASE}/api/training/kaggle/kernels?limit=${limit}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function launchKaggleTrain(payload: KaggleTrainPayload): Promise<{ job_id: string; status: string; message: string; model: string }> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/training/kaggle/train`, {
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
  const res = await sidecarFetch(`${TRAINING_BASE}/api/training/kaggle/monitor`, {
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

export async function pullKaggleModelArtifacts(model: string): Promise<{ job_id: string; status: string; model: string; message: string }> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/training/kaggle/pull`, {
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

export async function pushKaggleModelArtifacts(model: string): Promise<{ job_id: string; status: string; model: string; message: string }> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/training/kaggle/push`, {
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
  const res = await sidecarFetch(`${TRAINING_BASE}/api/notebooks/generate`, {
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

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Normalizes a sidecar unit test response so missing fields never crash the UI. */
export function normalizeUnitTestSuiteResult(data: unknown): UnitTestSuiteResult {
  const raw = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  return {
    status: typeof raw.status === "string" ? raw.status : "unknown",
    tests_run: toCount(raw.tests_run),
    failures_count: toCount(raw.failures_count),
    errors_count: toCount(raw.errors_count),
    failures: toStringList(raw.failures),
    errors: toStringList(raw.errors),
  };
}

async function postUnitTestSuite(url: string, payload: UnitTestSuitePayload, label: string): Promise<UnitTestSuiteResult> {
  const resp = await sidecarFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pattern: payload.pattern ?? "test_*.py" }),
  });
  if (!resp.ok) {
    throw new Error(`${label} returned HTTP ${resp.status}`);
  }
  return normalizeUnitTestSuiteResult(await resp.json());
}

/** Runs the Training Suite in-process unit tests (`POST /api/training/unit-test-run`). */
export async function runTrainingUnitTests(payload: UnitTestSuitePayload = {}): Promise<UnitTestSuiteResult> {
  return postUnitTestSuite(`${TRAINING_BASE}/api/training/unit-test-run`, payload, "Training Suite unit test run");
}

/** Runs the Dataset Compiler in-process test suite (`POST /api/llm/test-suite`). */
export async function runDatasetTestSuite(payload: UnitTestSuitePayload = {}): Promise<UnitTestSuiteResult> {
  return postUnitTestSuite(`${DATASETS_BASE}/api/llm/test-suite`, payload, "Dataset Compiler test suite");
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to generate model documentation: ${res.statusText}`);
  }
  return res.json();
}

export async function stageModelVariations(modelKey: string): Promise<ModelStageResponse> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/models/${encodeURIComponent(modelKey)}/export/stage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to stage model variations: ${res.statusText}`);
  }
  return res.json();
}

export async function validateModelIsolation(modelKey: string): Promise<ModelValidateIsolationResponse> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/models/${encodeURIComponent(modelKey)}/variations/validate`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to validate model isolation: ${res.statusText}`);
  }
  return res.json();
}

export async function pushKaggleModelVariation(payload: KagglePushModelPayload): Promise<KagglePushModelResponse> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/training/kaggle/push-model`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Failed to push model variation to Kaggle: ${res.statusText}`);
  }
  return res.json();
}

export async function pushAllKaggleModels(payload: KagglePushAllPayload = {}): Promise<KagglePushAllResponse> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/training/kaggle/push-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Failed to enqueue fleet Kaggle push: ${res.statusText}`);
  }
  return res.json();
}

export async function trainLLM(config: LLMTrainingConfig): Promise<LLMTrainResponse> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/training/llm/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Failed to dispatch LLM training: ${res.statusText}`);
  }
  return res.json();
}


// ─── Real-Time WebSocket Streaming ──────────────────────────────────────────

const MESH_WEBSOCKET_URLS = Object.values(MESH_SERVICES).map((svc) => ({
  id: svc.id,
  url: svc.wsUrl,
  defaultStep: svc.defaultStep,
  port: svc.defaultPort,
}));

const ANSI_CSI_REGEX = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g");

export function cleanAnsiAndControlChars(text: string): string {
  if (!text) return "";
  // If text contains carriage return(s), take the latest line segment
  if (text.includes("\r")) {
    const segments = text.split("\r").map((s) => s.trim()).filter(Boolean);
    if (segments.length > 0) {
      text = segments[segments.length - 1];
    }
  }
  // Strip ANSI escape sequences (\x1b[...] or \u001b[...])
  let cleaned = text.replace(ANSI_CSI_REGEX, "");
  // Strip leftover control characters like leading [K or cursor controls with parameter numbers (e.g. [2K, [0m)
  // Require at least one digit or semicolon so bracketed tags like [PROGRESS] or [GOVERNOR] are never truncated
  cleaned = cleaned
    .replace(/^\s*\[K\s*/, "")
    .replace(/^\[[0-9;]+[a-zA-Z]/, "")
    .replace(/^\[\?[0-9]+[a-zA-Z]/, "");
  cleaned = cleaned.trim();

  // Strip outdated ASCII progress bars; the modern GUI progress tracker renders the bar
  cleaned = cleaned
    .replace(/(\|[ █━─\-=#]+?\||\[[ █━─\-=#]+?\])/g, "")
    .replace(/^[ █━─\-=#|]+$/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned;
}

export function isProgressLine(msg: string): boolean {
  if (!msg) return false;
  // Package and requirement installation operations
  const hasPkgProgress =
    msg.includes("INSTALLING:") ||
    msg.includes("DOWNLOADING:") ||
    msg.includes("RESOLVING:") ||
    msg.includes("Installing requirements for") ||
    msg.includes("Running npm install for") ||
    msg.includes("Normalizing OpenCV provider") ||
    msg.startsWith("Collecting ") ||
    msg.startsWith("Requirement already satisfied:") ||
    msg.startsWith("Installing collected packages:");
  // Progress bar glyphs (e.g. 92% ──────── or ████ or |===|)
  const hasBar = /[\u2580-\u259F\u2500-\u257F━█─\-=]{3,}/.test(msg) && /\d+%/.test(msg);
  // Iteration rate indicators (e.g. 7875/8479 3.7it/s or 500/1000 [00:10<00:05, 10.2it/s] or 31.7M/3.84G)
  const hasRate = /\b\d+(?:\.\d+)?[KMGT]?\/\d+(?:\.\d+)?[KMGT]?\b\s+.*\b(it\/s|s\/it|B\/s|KB\/s|MB\/s|GB\/s|kB\/s)\b/i.test(msg);
  // Estimated completion timer pattern (e.g. 48:05<2:43 or 00:01<00:00)
  const hasEta = /\d+:\d+<\d+:\d+/.test(msg);
  // Classic tqdm formatting: 92%|████████  | 7875/8479 or |...| 92%
  const hasTqdm = (/\d+%\s*\|/.test(msg) || /\|\s*\d+/.test(msg)) && (/\d+\/\d+/.test(msg) || /it\/s|B\/s|kB\/s/i.test(msg));
  // Specific stages (Archiving, Uploading, Extraction) with percentage
  const hasStageProgress = (msg.includes("ARCHIVING:") || msg.includes("Uploading:") || msg.includes("EXTRACTING") || msg.includes("UNPACKING") || msg.includes("KAGGLE EXTRACTION") || msg.includes("EXTRACTION:") || (msg.includes("[UPLOAD]") && msg.includes("%")) || (msg.includes("[DOWNLOAD]") && msg.includes("%"))) && msg.includes("%");
  // Training and validation engine batch progression
  const hasBatch = /\[(?:VAL\s+)?BATCH\s+\d+\/\d+\]/i.test(msg);
  return hasPkgProgress || hasBar || hasRate || hasEta || hasTqdm || hasStageProgress || hasBatch;
}

/**
 * Rolls up consecutive progress ticks and batch metrics in-place, mirroring stdout carriage-return (\r) semantics.
 * Consecutive progress events (including [BATCH ...] training iterations, upload/download ticks, and tqdm frames)
 * update in a single line in the terminal output, while discrete operational milestones, errors, warnings,
 * and checkpoint saves are permanently preserved in terminal history.
 */
export function rollupTelemetryEvents(events: PipelineEvent[]): PipelineEvent[] {
  if (events.length === 0) return [];
  const result: PipelineEvent[] = [];

  for (const ev of events) {
    const msg = ev.message || "";
    const isProg = ev.is_progress || isProgressLine(msg);

    if (isProg && result.length > 0) {
      const last = result[result.length - 1];
      const lastIsProg = last.is_progress || isProgressLine(last.message || "");
      if (lastIsProg && last.step_name === ev.step_name && last.origin === ev.origin) {
        result[result.length - 1] = ev;
        continue;
      }
    }

    result.push(ev);
  }

  return result;
}

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

function jobRoutingData(raw: Record<string, unknown>): Record<string, unknown> | undefined {
  if (raw.job_id === undefined && raw.job_type === undefined) return undefined;
  return { job_id: raw.job_id, job_type: raw.job_type };
}

export function normalizeSocketMessage(
  data: unknown,
  defaultStep: string,
  origin?: "env-manager" | "training-suite" | "dataset-compiler",
  port?: number
): PipelineEvent | null {
  if (!data || typeof data !== "object") return null;

  const raw = data as Record<string, unknown>;

  // 1. Native PipelineEvent from env-manager (Port 8000)
  if (typeof raw.step_name === "string" && typeof raw.message === "string") {
    const cleanMsg = cleanAnsiAndControlChars(raw.message);
    if (!cleanMsg) return null;
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
      // Training-suite broadcasts carry job_id/job_type at the top level; keep them for stream routing.
      data: raw.data || jobRoutingData(raw)
        ? { ...jobRoutingData(raw), ...((raw.data as Record<string, unknown>) || {}) }
        : undefined,
      origin: origin || "env-manager",
      port: port || MESH_SERVICES["env-manager"].defaultPort,
    };
  }

  // 2. Training Suite daemon broadcast (Port 8200)
  if (typeof raw.message === "string") {
    const cleanMsg = cleanAnsiAndControlChars(raw.message);
    if (!cleanMsg) return null;
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
      data: jobRoutingData(raw),
      origin: origin || "training-suite",
      port: port || MESH_SERVICES["training-suite"].defaultPort,
    };
  }

  // 3. Dataset Compiler chunk broadcast (Port 8100)
  if (typeof raw.chunk === "string") {
    const cleanMsg = cleanAnsiAndControlChars(raw.chunk);
    if (!cleanMsg) return null;
    const isProgress = Boolean(isProgressLine(cleanMsg));
    return {
      step_number: 0,
      total_steps: 1,
      step_name: defaultStep,
      status: "info",
      message: cleanMsg,
      is_progress: isProgress,
      timestamp: new Date().toISOString(),
      origin: origin || "dataset-compiler",
      port: port || MESH_SERVICES["dataset-compiler"].defaultPort,
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
          const normalized = normalizeSocketMessage(parsed, endpoint.defaultStep, endpoint.id, endpoint.port);
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

export async function blendModelSoup(modelKey: string): Promise<{ model_key: string; success: boolean; soup_checkpoint: string | null }> {
  const res = await sidecarFetch(`${TRAINING_BASE}/api/models/${modelKey}/soup`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Failed to blend model soup: ${res.statusText}`);
  }
  return res.json();
}
