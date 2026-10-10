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

export const CANONICAL_PROJECT_NAMES: Record<string, string> = {
  "lemgendary-env-manager": "LemGendary Environment Manager",
  "lemgendary-datasets": "LemGendary Dataset Compiler Suite",
  "lemgendary-training-suite": "LemGendary Model Training Suite",
  "lemgendary-ai-studio-gui": "LemGendary AI Studio GUI",
  "lemgendary-docs": "LemGendary AI Documentation Hub",
  "LemGendaryDatasets": "LemGendary Compiled Manifolds Repo",
  "LemGendaryModels": "LemGendary Trained Models Repo",
};

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

export interface PipelineEvent {
  timestamp: string;
  step_number: number;
  total_steps: number;
  step_name: string;
  status: "info" | "success" | "warning" | "error";
  message: string;
  is_progress?: boolean;
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

export interface SecretItem {
  id: string;
  service: "kaggle" | "google_drive" | "github" | "huggingface" | "metatrader5" | "saturn_cloud" | "wandb" | "custom" | string;
  label: string;
  username?: string;
  secret_value: string;
  server?: string;
  is_default?: boolean;
  created_at?: string;
}

export interface DocsStatusResponse {
  offline_available: boolean;
  local_url: string;
  online_url: string;
}

export interface DatasetFormatBreakdown {
  webp: number;
  jpg: number;
  png: number;
  parquet: number;
  other: number;
}

export interface DatasetSourceItem {
  name: string;
  ref?: string;
  count?: number;
  type?: string;
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
  task?: string;
  sources?: DatasetSourceItem[];
  kaggle_ref?: string;
}

export interface BackendDatasetStats {
  name: string;
  key?: string;
  display_name?: string;
  path: string;
  task: string;
  sample_count: number;
  size_bytes: number;
  size_gb: number;
  format?: string;
  canonical_format?: string;
  formats: DatasetFormatBreakdown;
  shards_count?: number;
  is_compiled?: boolean;
  has_hardlinks?: boolean;
  hardlink_ratio?: number;
  sources?: DatasetSourceItem[];
  kaggle_ref?: string;
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

export interface KaggleDatasetRegistryItem {
  key: string;
  title: string;
  name: string;
  modernized_folder: string;
  kaggle_ref: string;
  clean_repo_id: string;
  is_local_present: boolean;
  canonical_format: string;
  sample_count: number;
  size_gb: number;
}

export interface KaggleStatusResponse {
  authenticated: boolean;
  auth_methods: {
    environment_variables: boolean;
    dot_kaggle_token: boolean;
    user_kaggle_json: boolean;
  };
}

export interface KaggleDownloadPayload {
  kaggle_ref: string;
  target_folder?: string;
  force?: boolean;
}

export interface KaggleUploadPayload {
  manifold: string;
  kaggle_ref?: string;
  no_wait?: boolean;
}

export interface CustomCompilePayload {
  custom_name: string;
  task: string;
  preset: string;
  canonical_format: string;
  shard_size: number;
  sources: string[];
  purge_loose_images?: boolean;
}

export interface ModelItem {
  key: string;
  display_name: string;
  architecture: string;
  task_type: string;
  category?: string;
  canonical_format?: string;
  parameters_m?: number;
  spatial_ladder?: number[];
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
  checkpoint_exists?: boolean;
  preferred_parallel?: "single" | "dp" | "ddp";
  epochs_completed?: number;
  best_metric?: number;
  metric_name?: string;
  sota_target?: number;
  sota_reached?: boolean;
  sota_targets_total?: number;
  sota_targets_met?: number;
  sota_all_met?: boolean;
  sota_details?: SotaMetricDetail[];
  best_metrics_details?: BestMetricDetail[];
  training_status?: "fully_trained" | "partially_trained" | "weights_ready" | "initializing" | string;
  status?: "PLANNED" | "SPECIFICATION" | "DATASET_READY" | "TRAINING" | "TRAINED" | "VALIDATED" | "PRODUCTION" | "DEPRECATED" | string;
  authoritative_status?: string;
  learning_rate?: number;
  batch_size?: number;
  default_epochs?: number;
}

export interface SotaMetricDetail {
  key: string;
  label: string;
  target: number;
  achieved: number | null;
  lower_is_better: boolean;
  passed: boolean;
}

export interface BestMetricDetail {
  key: string;
  label: string;
  value: number | null;
  target?: number | null;
  lower_is_better?: boolean;
  passed?: boolean;
}

export interface QuickTrainPayload {
  model_key: string;
  preset?: string;
  clean?: boolean;
  epochs?: number;
  batch_size?: number;
  learning_rate?: number;
  env?: string;
  ladder_stage?: number;
  enable_sawtooth?: boolean;
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

export interface MeshStatus {
  envManager: boolean;
  datasetCompiler: boolean;
  trainingSuite: boolean;
}

export interface ServiceOperationResult {
  status: string;
  message: string;
  port?: number;
  pid?: number;
}

export interface TrainingJobInfo {
  id: string;
  job_type: string;
  model_key: string;
  status: string;
  created_at?: string;
  started_at?: string;
  params?: Record<string, unknown>;
}

export interface KaggleKernelItem {
  ref: string;
  title: string;
  status: string;
  failure_message?: string | null;
}

export interface KaggleTrainPayload {
  model: string;
  gpu?: string;
  auto_pull?: boolean;
  poll_interval?: number;
}

export interface KaggleMonitorPayload {
  kernel_slug: string;
  model?: string;
  auto_pull?: boolean;
  poll_interval?: number;
}

export interface KaggleSuiteStatus {
  authenticated: boolean;
  username: string;
  token_configured: boolean;
}

