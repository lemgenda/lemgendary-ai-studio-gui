/**
 * LemGendary AI Studio - Dataset Compiler contracts: catalog, presets,
 * compilation jobs, Kaggle datasets and modernization.
 */

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

/** One preset from `presets.yaml` (`CompilerPresetModel`). */
export interface CompilerPreset {
  name: string;
  title: string;
  description: string;
  image_format: string;
  image_quality: number;
  target_quality?: number | null;
  mask_format?: string | null;
  min_resolution?: number | null;
  resampling?: string | null;
  vetting_enabled?: boolean;
  labeling_enabled?: boolean;
  hardlink_gate?: boolean;
  containers?: string[];
}

/** `GET /api/gui/presets` (`PresetListResponse`): presets keyed by name. */
export interface CompilerPresetListResponse {
  presets: Record<string, CompilerPreset>;
  total: number;
}

/** `POST /api/gui/quick-compile` (`QuickCompileRequest`). Omit `preset` for the server default. */
export interface QuickCompilePayload {
  model: string;
  preset?: string;
  max_gb?: number | null;
  workers?: number | null;
}

/** Dataset Compiler job types (`JobType`). */
export type DatasetJobType =
  | "compile"
  | "degrade"
  | "reduce"
  | "modernize"
  | "label"
  | "prompt"
  | "mask"
  | "audit"
  | "sync"
  | "custom"
  | "llm";

/** Dataset Compiler job states (`JobState`). */
export type DatasetJobState = "pending" | "running" | "completed" | "failed" | "interrupted" | "cancelled";

/** Job record returned by every Dataset Compiler job route (`JobResponse`); the id field is `id`. */
export interface DatasetJobResponse {
  id: string;
  job_type: DatasetJobType;
  state: DatasetJobState;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  exit_code?: number | null;
  error_message?: string | null;
  log_file: string;
  parameters?: Record<string, unknown>;
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

/** `POST /api/gui/custom-compile` (`CustomCompileRequest`). Omit `preset` for presets.yaml `default_preset`. */
export interface CustomCompilePayload {
  custom_name: string;
  task?: string;
  preset?: string;
  canonical_format?: string;
  shard_size?: number;
  sources?: string[];
  purge_loose_images?: boolean;
}

/** One entry of `GET /api/modernize/queue`, which returns a bare list (`QueueItemResponse`). */
export interface ModernizationQueueItem {
  key: string;
  name: string;
  canonical_format: string;
  modernized_folder: string;
  kaggle_ref: string;
  title: string;
  subtitle: string;
  is_containerized: boolean;
  has_loose_files: boolean;
  container_bytes: number;
  container_gb: number;
  status_label: string;
  source_label: string;
}

/** `POST /api/modernize/run` (`ModernizeRunRequest`). */
export interface ModernizeRunPayload {
  datasets?: string[] | null;
  dataset?: string | null;
  workers?: number | null;
  mds_shard_mb?: number | null;
  purge_loose?: boolean;
  push_kaggle?: boolean;
  dry_run?: boolean;
  force?: boolean;
}

/** `POST /api/modernize/reduce` (`ManifoldReduceRequest`); `scale` in (0, 1] is a sample fraction. */
export interface ManifoldReducePayload {
  dataset_key?: string | null;
  manifold?: string | null;
  scale?: number | null;
  workers?: number | null;
  max_gb?: number | null;
  suffix?: string | null;
  dry_run?: boolean;
}

/** `POST /api/modernize/regenerate-manifolds` response. */
export interface RegenerateManifoldsResponse {
  status: string;
  message: string;
}
