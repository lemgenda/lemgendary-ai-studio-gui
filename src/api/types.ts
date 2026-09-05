/**
 * LemGendary AI Studio - Shared Type Definitions
 */

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

export interface PipelineEvent {
  timestamp: string;
  step_number: number;
  total_steps: number;
  step_name: string;
  status: "info" | "success" | "warning" | "error";
  message: string;
  data?: Record<string, any>;
}

export interface PipelineStatus {
  is_running: boolean;
  last_status: string;
  last_run_timestamp?: string;
  recent_events: PipelineEvent[];
}
