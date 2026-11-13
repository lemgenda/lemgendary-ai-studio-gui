/**
 * LemGendary AI Studio - Training Suite contracts: models, jobs,
 * Kaggle cloud training, unit tests, exports and model variations.
 */

import type { EcosystemKaggleAccelerator } from "../ecosystem";

/** Training state from the Training Suite 4-pillar verdict (`ModelWithStats.training_status`). */
export type TrainingStatus = "fully_trained" | "partially_trained" | "weights_ready" | "initializing" | "unknown";

export interface ModelItem {
  key: string;
  display_name: string;
  architecture: string;
  task_type: string;
  category?: string;
  canonical_format?: string;
  /** `null` when the Training Suite does not know it. */
  parameters_m?: number | null;
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
  /**
   * Per-format artifact readiness: true when that physical file exists
   * (PyTorch `.pt`, ONNX FP32 `_FP32.onnx`, ONNX FP16 `.onnx`). Absent when the
   * Training Suite does not report it; the GUI then shows the format as unknown.
   */
  pytorch_ready?: boolean;
  onnx_fp32_ready?: boolean;
  onnx_fp16_ready?: boolean;
  /** Always sent by the Training Suite; true only when all 4 completion pillars hold. */
  is_fully_trained: boolean;
  preferred_parallel?: "single" | "dp" | "ddp";
  epochs_completed?: number;
  /** `null` until a best value is known; may be a non-numeric string. */
  best_metric?: number | string | null;
  metric_name?: string;
  sota_target?: number | string | null;
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
  target: number | string | null;
  achieved: number | null;
  lower_is_better: boolean;
  passed: boolean;
}

export interface BestMetricDetail {
  key: string;
  label: string;
  value: number | string | null;
  target?: number | string | null;
  lower_is_better?: boolean;
  passed?: boolean;
}

export interface QuickTrainPayload {
  model_key: string;
  preset?: string;
  clean?: boolean;
  /** Resume although a frozen run setting changed (logged and recorded); default false. */
  override_frozen?: boolean;
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
  /** Result record of a finished job (`metrics_json`); `{}` while running. */
  metrics?: Record<string, unknown>;
}

export interface KaggleKernelItem {
  ref: string;
  title: string;
  status: string;
  failure_message?: string | null;
}

/** `poll_interval` default and minimum of `KaggleTrainRequest` (checked against the OpenAPI). */
export const KAGGLE_POLL_DEFAULT_SECONDS = 30;
export const KAGGLE_POLL_MIN_SECONDS = 5;
/** `max_resumes` minimum of `KaggleTrainRequest` (checked against the OpenAPI). */
export const KAGGLE_MAX_RESUMES_MIN = 0;

/** `KaggleTrainRequest` of `POST /api/training/kaggle/train`. */
export interface KaggleTrainPayload {
  model: string;
  /** Accelerator id from `GET /api/training/kaggle/accelerators`; omitted = backend default. */
  accelerator?: string;
  auto_pull?: boolean;
  /** First status poll interval in seconds (minimum 5, default 30; backs off to 300). */
  poll_interval?: number;
  /** Push a new kernel version after a deadline stop; omitted = `kaggle_session.auto_resume`. */
  auto_resume?: boolean;
  /** Most resume sessions of this job; omitted = `kaggle_session.max_resumes` of config.yaml. */
  max_resumes?: number;
  /** Pass `--override-frozen` to the kernel trainer (every resume session too); default false. */
  override_frozen?: boolean;
  /** Branch, tag or full commit SHA the kernel clones the Training Suite at; omitted = `main`. */
  git_ref?: string;
  /** Ref the kernel clones the Environment Manager at; omitted = the `git_ref` value. */
  env_manager_ref?: string;
  /** Session limit in hours for this kernel (> 0); omitted = `kaggle_session.limit_hours`. */
  limit_hours?: number;
  /** Minutes before the limit the trainer stops (>= 0); omitted = `kaggle_session.margin_minutes`. */
  margin_minutes?: number;
}

/** `limit_hours` exclusive minimum of `KaggleTrainRequest` (checked against the OpenAPI). */
export const KAGGLE_LIMIT_HOURS_EXCLUSIVE_MIN = 0;
/** `margin_minutes` minimum of `KaggleTrainRequest` (checked against the OpenAPI). */
export const KAGGLE_MARGIN_MINUTES_MIN = 0;
/**
 * Longest git ref the Training Suite accepts (`MAX_GIT_REF_LENGTH` of
 * `training/notebooks/git_ref.py`; the OpenAPI types the field as a plain string).
 */
export const KAGGLE_GIT_REF_MAX_LENGTH = 200;

/**
 * One Kaggle session type: `id` is what `KaggleTrainPayload.accelerator` takes.
 * Same shape as the ecosystem `kaggle.accelerators` entries the route serves.
 */
export type KaggleAccelerator = EcosystemKaggleAccelerator;

/** `GET /api/training/kaggle/accelerators` (retired machine shapes are left out). */
export interface KaggleAcceleratorList {
  default: string;
  accelerators: KaggleAccelerator[];
}

export interface KaggleMonitorPayload {
  kernel_slug: string;
  model?: string;
  auto_pull?: boolean;
  poll_interval?: number;
}

/** How the Training Suite authenticated against Kaggle. */
export type KaggleAuthMethod = "access_token" | "legacy_api_key";

/**
 * `GET /api/training/kaggle/status`: the outcome of one real authenticated call
 * (list the user's own kernels). `authenticated` is what Kaggle answered.
 */
export interface KaggleSuiteStatus {
  authenticated: boolean;
  username: string;
  token_configured: boolean;
  auth_method: KaggleAuthMethod | null;
  /** HTTP status of the probe call; null when no call was made (no token) or no response. */
  http_status: number | null;
  /** Why the probe failed; null when authenticated. */
  error: string | null;
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

/**
 * Kaggle Model Instance keys: OpenAPI enum `VariationKey` of the Training Suite
 * (`training/cloud/variations.py`). Mirrored here; `trainingContract.test.ts`
 * compares it with `lemgendary-training-suite/openapi.json`.
 */
export const VARIATION_KEYS = ["pytorch/default", "pytorch/fp32", "onnx/fp16", "onnx/fp32"] as const;

export type VariationKey = (typeof VARIATION_KEYS)[number];

/** Request value of the Kaggle pull/push routes: one variation or `"all"`. */
export type VariationChoice = VariationKey | "all";

export interface ModelVariationInfo {
  variation: VariationKey;
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

/** `KagglePushModelRequest` of `POST /api/training/kaggle/push-model`. */
export interface KagglePushModelPayload {
  model: string;
  variation?: VariationChoice;
  version_notes?: string;
  dry_run?: boolean;
}

/** One variation of a push result (`ModelPushResult.to_dict`). */
export interface KaggleVariationPushResult {
  variation: string;
  handle: string;
  success: boolean;
  files: string[];
  error?: string | null;
  dry_run: boolean;
  /** True when the payload equals the last upload: unchanged, no new Hub version. */
  skipped?: boolean;
}

/** `POST /api/training/kaggle/push-model` (HTTP 200 also when `success` is false). */
export interface KagglePushModelResponse {
  model_key: string;
  success: boolean;
  variations: Record<string, KaggleVariationPushResult>;
  is_valid_isolation?: boolean;
  metadata_sync?: Record<string, unknown> | null;
  errors: string[];
}

export interface KagglePushAllPayload {
  variation?: VariationChoice;
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
