/**
 * LemGendary AI Studio - Training Suite contracts: models, jobs,
 * Kaggle cloud training, unit tests, exports and model variations.
 */

/** Training state from the Training Suite 4-pillar verdict (`ModelWithStats.training_status`). */
export type TrainingStatus = "fully_trained" | "partially_trained" | "weights_ready" | "initializing" | "unknown";

export interface ModelItem {
  key: string;
  display_name: string;
  architecture: string;
  task_type: string;
  category?: string;
  canonical_format?: string;
  parameters_m?: number;
  spatial_ladder?: number[];
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
  checkpoint_exists?: boolean;
  /** Always sent by the Training Suite; true only when all 4 completion pillars hold. */
  is_fully_trained: boolean;
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
  /** Always sent by the Training Suite; never guessed by the GUI. */
  training_status: TrainingStatus;
  /** Why the sidecar could not compute stats (status is then `unknown`). */
  stats_error?: string | null;
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

export interface TrainingJobInfo {
  id: string;
  job_type: string;
  model_key: string;
  status: string;
  created_at?: string;
  started_at?: string;
  error_message?: string | null;
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
  username?: string;
  key?: string;
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

export interface UnitTestAllPayload {
  epochs?: number;
  env?: string;
  force?: boolean;
}

/** Request body for the in-process sidecar unit test runners. */
export interface UnitTestSuitePayload {
  pattern?: string;
}

/**
 * Result of an in-process unit test run. Returned by Training Suite
 * `POST /api/training/unit-test-run` and Dataset Compiler `POST /api/llm/test-suite`.
 */
export interface UnitTestSuiteResult {
  status: string;
  tests_run: number;
  failures_count: number;
  errors_count: number;
  failures: string[];
  errors: string[];
}

export interface ModelEvalPayload {
  model: string;
  checkpoint_path?: string;
  batch_size?: number;
  env?: string;
}

export interface ModelExportPayload {
  model: string;
  checkpoint_path?: string;
  output_dir?: string;
  targets?: string[];
}

export interface ModelVariationInfo {
  variation: "pytorch" | "onnx_fp32" | "onnx_fp16";
  exists: boolean;
  files: string[];
  is_valid: boolean;
  errors?: string[];
}

export interface ModelDocGenResponse {
  status: string;
  model_key: string;
  readme_path: string;
  metadata_path: string;
  message?: string;
}

export interface ModelStageResponse {
  status: string;
  model_key: string;
  staged_files: Record<string, string>;
  is_valid: boolean;
  errors: string[];
  message: string;
}

export interface VariationValidationDetail {
  variation: string;
  is_valid: boolean;
  files_found: string[];
  errors: string[];
  warnings: string[];
}

export interface ModelValidateIsolationResponse {
  model_key: string;
  is_valid: boolean;
  variations: Record<string, VariationValidationDetail>;
  all_errors: string[];
}

export interface KagglePushModelPayload {
  model: string;
  variation?: "all" | "pytorch" | "onnx_fp32" | "onnx_fp16";
  version_notes?: string;
  dry_run?: boolean;
  username?: string;
  key?: string;
}

export interface KagglePushModelResponse {
  model_key: string;
  success: boolean;
  variations: Record<string, {
    variation: string;
    handle: string;
    success: boolean;
    files: string[];
    error?: string | null;
    dry_run: boolean;
  }>;
  isolation_report?: ModelValidateIsolationResponse;
  errors: string[];
}

export interface KagglePushAllPayload {
  variation?: "all" | "pytorch" | "onnx_fp32" | "onnx_fp16";
  version_notes?: string;
  dry_run?: boolean;
}

export interface KagglePushAllResponse {
  job_id: string;
  status: string;
  message: string;
  variation: string;
  dry_run: boolean;
}

export interface LLMTrainingConfig {
  model?: string;
  epochs?: number;
  batch_size?: number;
  lr?: number;
  env?: "local" | "kaggle" | "colab";
}

export interface LLMTrainResponse {
  job_id: string;
  status: string;
  message: string;
  config?: Record<string, unknown>;
}
