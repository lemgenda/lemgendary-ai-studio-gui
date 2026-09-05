/**
 * LemGendary AI Studio - API Client
 */

import { HardwareProfile, HealthAuditReport, PipelineEvent, PipelineStatus, ProjectHealth } from "./types";

const API_BASE = "http://127.0.0.1:8000";
const WS_URL = "ws://127.0.0.1:8000/ws/log";

export async function fetchHardware(): Promise<HardwareProfile> {
  const res = await fetch(`${API_BASE}/api/hardware`);
  if (!res.ok) throw new Error(`Failed to fetch hardware profile: ${res.statusText}`);
  return res.json();
}

export async function fetchHealth(): Promise<HealthAuditReport> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`Failed to fetch health report: ${res.statusText}`);
  return res.json();
}

export async function fetchProjects(): Promise<ProjectHealth[]> {
  const res = await fetch(`${API_BASE}/api/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.statusText}`);
  return res.json();
}

export async function fetchPipelineStatus(): Promise<PipelineStatus> {
  const res = await fetch(`${API_BASE}/api/pipeline/status`);
  if (!res.ok) throw new Error(`Failed to fetch pipeline status: ${res.statusText}`);
  return res.json();
}

export async function triggerPipeline(targetProject?: string): Promise<{ status: string; message?: string }> {
  const res = await fetch(`${API_BASE}/api/pipeline/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_project: targetProject || null }),
  });
  if (!res.ok) throw new Error(`Failed to trigger pipeline: ${res.statusText}`);
  return res.json();
}

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
