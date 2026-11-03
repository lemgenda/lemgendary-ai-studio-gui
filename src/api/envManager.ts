/**
 * LemGendary AI Studio - Environment Manager: hardware, health, pipeline,
 * maintenance, documentation hub status and bug reports.
 */

import { bugReportErrorFromResponse, BugReportSubmitError } from "../bugReport/serverErrors";
import { ENV_BASE } from "./endpoints";
import { sidecarFetch } from "./http";
import { readErrorBody, throwHttpError } from "./request";
import {
  BugReportResponse,
  DeepCleanResponse,
  DocsStatusResponse,
  EcosystemSidecarMesh,
  HardwareProfile,
  HealthAuditReport,
  HooksInstallResponse,
  PipelineStatus,
  ProjectHealth,
} from "./types";

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
    const body = await readErrorBody(resp, "Safe package update");
    const detail = (body as { detail?: unknown } | null)?.detail;
    throw new Error(`Safe package update failed (${resp.status}): ${typeof detail === "string" ? detail : resp.statusText}`);
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

/**
 * Offline documentation hub status from the Environment Manager, which also
 * serves the hub at `local_url`. Throws when the Environment Manager is unreachable.
 */
export async function fetchDocsStatus(): Promise<DocsStatusResponse> {
  const res = await sidecarFetch(`${ENV_BASE}/api/docs/status`);
  if (!res.ok) return throwHttpError(res, "Documentation hub status");
  return res.json();
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
    const body = await readErrorBody(res, "Bug report submission");
    throw bugReportErrorFromResponse(res.status, res.statusText, body);
  }
  return (await res.json()) as BugReportResponse;
}
