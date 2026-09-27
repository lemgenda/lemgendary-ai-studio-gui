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
  data?: Record<string, unknown>;
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

export interface DatasetFormatBreakdown {
  webp: number;
  jpg: number;
  png: number;
  parquet: number;
  other: number;
}

export interface DatasetItem {
  key: string;
  display_name: string;
  format: string;
  canonical_format?: string;
  total_samples: number;
  total_size_mb: number;
  format_breakdown: DatasetFormatBreakdown;
  shards_count?: number;
  is_compiled: boolean;
  modernized_folder?: string;
}

export interface CompilerPreset {
  id: string;
  name: string;
  description: string;
  target_format: string;
  shard_size: number;
  lossless: boolean;
}

export interface QuickCompilePayload {
  manifold_key: string;
  preset?: string;
  target_format?: string;
  shard_size?: number;
  purge_loose_images?: boolean;
}

export interface ModelItem {
  key: string;
  display_name: string;
  architecture: string;
  task_type: string;
  canonical_format?: string;
  parameters_m?: number;
  spatial_ladder?: number[];
  checkpoint_exists?: boolean;
  preferred_parallel?: "single" | "dp" | "ddp";
  epochs_completed?: number;
  best_metric?: number;
  metric_name?: string;
}

export interface QuickTrainPayload {
  model_key: string;
  preset?: string;
  clean?: boolean;
  epochs?: number;
  batch_size?: number;
  learning_rate?: number;
  env?: string;
}

export interface SidecarNodeStatus {
  service: string;
  port: number;
  status: "online" | "offline" | "error";
  reachable: boolean;
  error?: string;
}

export interface EcosystemSidecarMesh {
  env_manager: SidecarNodeStatus;
  dataset_compiler: SidecarNodeStatus;
  training_suite: SidecarNodeStatus;
}

