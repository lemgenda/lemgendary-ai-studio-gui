/**
 * LemGendary AI Studio - Environment Manager contracts: hardware, health,
 * pipeline, manifests, secrets, maintenance and bug reports.
 */

import { PipelineEvent } from "./mesh";
import { ECOSYSTEM } from "../ecosystem";

export interface AcceleratorDevice {
  index: number;
  name: string;
  total_memory_mb: number;
  backend: "cuda" | "rocm" | "directml" | "cpu";
  driver_version?: string;
  compute_capability?: string;
}

export interface HardwareProfile {
  os_name: string;
  os_version: string;
  os_release: string;
  architecture: string;
  python_version: string;
  python_executable: string;
  cpu_count_logical: number;
  cpu_count_physical: number;
  total_ram_mb: number;
  primary_backend: "cuda" | "rocm" | "directml" | "cpu";
  accelerators: AcceleratorDevice[];
  recommended_torch_index: string;
}

export interface BootstrapStatus {
  python_valid: boolean;
  python_version: string;
  python_executable: string;
  pip_installed: boolean;
  venv_available: boolean;
  git_installed: boolean;
  git_version?: string;
  npm_installed: boolean;
  npm_version?: string;
  missing_prerequisites: string[];
  remediation_instructions: string[];
}

export interface ProjectHealth {
  name: string;
  project_dir: string;
  venv_exists: boolean;
  python_version?: string;
  total_required: number;
  total_installed: number;
  missing_packages: string[];
  installed_packages: Record<string, string>;
  is_healthy: boolean;
}

/** Project folder to display name, derived from the ecosystem snapshot. */
export const CANONICAL_PROJECT_NAMES: Record<string, string> = Object.fromEntries(
  ECOSYSTEM.projects.map((p) => [p.folder, p.display_name]),
);

export function getProjectDisplayName(name: string): string {
  return CANONICAL_PROJECT_NAMES[name] || name;
}

export interface VersionDriftEntry {
  package_name: string;
  versions: Record<string, string | null>;
  has_drift: boolean;
}

export interface HealthAuditReport {
  bootstrap: BootstrapStatus;
  hardware: HardwareProfile;
  projects: ProjectHealth[];
  version_drift: VersionDriftEntry[];
  overall_healthy: boolean;
}

export interface PipelineStatus {
  is_running: boolean;
  last_status: string;
  last_run_timestamp?: string;
  recent_events: PipelineEvent[];
}

export interface ManifestItem {
  name: string;
  project: string;
  format: "yaml" | "json" | "text";
  description: string;
  exists: boolean;
  size_bytes: number;
  path: string | null;
}

export interface ManifestReadResponse {
  name: string;
  format: "yaml" | "json" | "text";
  path: string;
  content: string;
}

export interface ManifestValidateResponse {
  valid: boolean;
  error?: string | null;
}

export interface ManifestSaveResponse {
  status: string;
  name: string;
  bytes_written: number;
}

/** Secret as listed by `GET /api/secrets`: masked, never carries the value. */
export interface SecretItem {
  id: string;
  service: "kaggle" | "google_drive" | "github" | "huggingface" | "metatrader5" | "saturn_cloud" | "wandb" | "custom" | string;
  label: string;
  username?: string | null;
  server?: string | null;
  is_default?: boolean;
  created_at?: string | null;
  /** Whether a value is stored server-side. */
  has_value: boolean;
  /** Last 4 characters of the stored value, or "" when it is shorter than 8. */
  value_hint: string;
}

/**
 * Secret being edited in the GUI. `secret_value` is a new value typed by the
 * user; empty or missing means "keep the stored value".
 */
export interface SecretDraft extends SecretItem {
  secret_value?: string;
}

/** Secret as sent to `POST /api/secrets` (write-only). */
export interface SecretWriteItem {
  id: string;
  service: string;
  label: string;
  username?: string | null;
  server?: string | null;
  is_default?: boolean;
  created_at?: string | null;
  /** Empty string keeps the stored value for this id. */
  secret_value: string;
}

export interface SecretsPropagationIssue {
  path: string;
  reason: string;
}

export interface SecretsSaveResponse {
  status: string;
  count: number;
  message: string;
  propagation?: {
    written: string[];
    skipped: SecretsPropagationIssue[];
    failed: SecretsPropagationIssue[];
  };
}

export interface DocsStatusResponse {
  offline_available: boolean;
  local_url: string;
  online_url: string;
}

export interface HookInstallItem {
  project: string;
  success: boolean;
  message: string;
}

export interface HooksInstallResponse {
  status: string;
  all_ok: boolean;
  results: HookInstallItem[];
}

export interface DeepCleanResponse {
  status: string;
  cleaned_count: number;
  reclaimed_bytes: number;
  reclaimed_mb: number;
}

/** `POST /api/bug-report` (Environment Manager) success body. */
export interface BugReportResponse {
  report_id: string;
  archive_name: string;
  /** Relative to the workspace root, forward slashes. */
  archive_path: string;
  recipient: string;
  subject: string;
  mail_client_opened: boolean;
  folder_revealed: boolean;
}
