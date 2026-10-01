/**
 * LemGendary AI Studio - Tripartite Multi-Sidecar API Client
 */

import {
  CompilerPreset,
  DatasetItem,
  DocsStatusResponse,
  EcosystemSidecarMesh,
  HardwareProfile,
  HealthAuditReport,
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
} from "./types";

export type { MeshStatus };

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
  const timer = window.setTimeout(() => controller.abort(), 1500);
  try {
    await fetch(`http://127.0.0.1:${port}/api/health`, {
      method: "HEAD",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
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
    return data.datasets || [];
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

// ─── Training Suite Sidecar (Port 8200) ─────────────────────────────────────

export async function fetchModels(): Promise<ModelItem[]> {
  try {
    const res = await fetch(`${TRAINING_BASE}/api/gui/models/with-stats`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.models || [];
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
