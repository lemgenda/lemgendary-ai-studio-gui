/**
 * LemGendary AI Studio - Training Suite (Port 8200) model catalog normalization.
 */

import { logger } from "../utils/logger";
import { TRAINING_BASE } from "./endpoints";
import { sidecarFetch } from "./http";
import { BestMetricDetail, ModelItem, SotaMetricDetail } from "./types";

interface RawModelData {
  key?: string;
  model_key?: string;
  name?: string;
  display_name?: string;
  category?: string;
  task_type?: string;
  architecture?: string;
  architecture_type?: string;
  class_name?: string;
  canonical_format?: string;
  parameters_m?: number;
  best_checkpoint_size_mb?: number | null;
  spatial_ladder?: number[];
  resolution?: number | number[] | null;
  checkpoint_exists?: boolean;
  has_best_checkpoint?: boolean;
  checkpoints_count?: number;
  preferred_parallel?: "single" | "dp" | "ddp";
  epochs_completed?: number;
  latest_checkpoint_epoch?: number | null;
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
  best_metric?: number;
  metric_name?: string;
  sota_target?: number;
  sota_reached?: boolean;
  sota_targets_total?: number;
  sota_targets_met?: number;
  sota_all_met?: boolean;
  sota_details?: SotaMetricDetail[];
  best_metrics_details?: BestMetricDetail[];
  is_fully_trained?: boolean;
  training_status?: string;
  learning_rate?: number;
  batch_size?: number;
  default_epochs?: number;
}

export async function fetchModels(): Promise<ModelItem[]> {
  try {
    const res = await sidecarFetch(`${TRAINING_BASE}/api/gui/models/with-stats`);
    if (!res.ok) {
      logger.warn(`Model catalog request failed: HTTP ${res.status} ${res.statusText}`);
      return [];
    }
    const data = (await res.json()) as RawModelData[] | { models?: RawModelData[] };
    const rawList: RawModelData[] = Array.isArray(data) ? data : (data.models || []);

    // `with-stats` already carries the live metrics.csv telemetry (active_res,
    // data_fraction_completed, epochs_completed) for every model: one request, no N+1.
    return rawList.map((item) => {
      const modelKey = item.key || item.model_key || "";
      const isForex = item.is_forex ?? (modelKey === "forex_predictor" || item.category === "forex" || item.task_type === "forex");
      const isLlm = item.is_llm ?? (modelKey === "ai_helper_lemgend" || item.category === "llm" || item.task_type === "llm" || item.task_type === "text_instruction");
      const ladderType = item.ladder_type ?? (isForex ? "timeframe" : isLlm ? "context_tokens" : "spatial");
      const spatialLadder: number[] = Array.isArray(item.spatial_ladder) && item.spatial_ladder.length > 0
        ? item.spatial_ladder
        : Array.isArray(item.resolution)
        ? (item.resolution as number[])
        : typeof item.resolution === "number"
        ? [item.resolution]
        : []; // ladder comes from the sidecar only; empty means unknown

      const displayName = item.display_name || item.name || modelKey;
      const arch = item.architecture || item.architecture_type || item.class_name || "PyTorch Architecture";
      const task = item.task_type || item.category || "general";
      const canonicalFmt = item.canonical_format || "webdataset";
      const paramsM = item.parameters_m ?? (item.best_checkpoint_size_mb ? Math.round(item.best_checkpoint_size_mb * 0.25 * 10) / 10 : undefined);
      const ckptExists = item.checkpoint_exists ?? (item.has_best_checkpoint === true || (item.checkpoints_count !== undefined && item.checkpoints_count > 0));
      const parallelMode = item.preferred_parallel || "single";
      const completedEpochs = item.epochs_completed ?? item.latest_checkpoint_epoch ?? 0;
      const metricVal = item.best_metric;
      const metricLabel = item.metric_name || "Metric";
      const sotaTarget = item.sota_target;
      const sotaReached = item.sota_reached ?? false;
      const targetRes = item.target_res ?? (spatialLadder.length > 0 ? spatialLadder[spatialLadder.length - 1] : null);

      const activeRes = item.active_res ?? item.max_res_completed ?? (spatialLadder.length > 0 ? spatialLadder[0] : null);
      const ladderPassed = item.ladder_passed ?? (targetRes !== null && typeof activeRes === "number" && activeRes >= targetRes);

      const dataFractionCompleted = typeof item.data_fraction_completed === "number" ? item.data_fraction_completed : 0;

      // Data fraction is only passed if current rung >= 99% AND ladder is passed (or SOTA reached with checkpoint)
      const dataFractionPassed = item.data_fraction_passed ?? ((dataFractionCompleted >= 0.99 && ladderPassed) || (sotaReached && ckptExists));
      // The Training Suite owns this verdict; without it, only the governance criteria count (no epoch-count rule).
      const isFullyTrained = item.is_fully_trained ?? (sotaReached && ladderPassed && dataFractionPassed);

      const status = item.training_status || (
        isFullyTrained
          ? "fully_trained"
          : completedEpochs > 0
          ? "partially_trained"
          : ckptExists
          ? "weights_ready"
          : "initializing"
      );

      return {
        key: modelKey,
        display_name: displayName,
        architecture: arch,
        task_type: task,
        category: item.category,
        canonical_format: canonicalFmt,
        parameters_m: paramsM,
        spatial_ladder: spatialLadder,
        ladder_type: ladderType,
        is_forex: isForex,
        is_llm: isLlm,
        ladder_passed: ladderPassed,
        active_res: activeRes,
        max_res_completed: item.max_res_completed ?? null,
        target_res: targetRes,
        active_fold: item.active_fold ?? null,
        total_folds: item.total_folds ?? null,
        fold_years_label: item.fold_years_label ?? null,
        active_data_fraction: item.active_data_fraction ?? null,
        data_fraction_completed: dataFractionCompleted,
        data_fraction_passed: dataFractionPassed,
        kaggle_ref: item.kaggle_ref,
        kaggle_dataset_urls: item.kaggle_dataset_urls,
        checkpoint_exists: ckptExists,
        is_fully_trained: isFullyTrained,
        preferred_parallel: parallelMode,
        epochs_completed: completedEpochs,
        best_metric: metricVal,
        metric_name: metricLabel,
        sota_target: sotaTarget,
        sota_reached: sotaReached,
        sota_targets_total: item.sota_targets_total,
        sota_targets_met: item.sota_targets_met,
        sota_all_met: item.sota_all_met,
        sota_details: item.sota_details,
        best_metrics_details: item.best_metrics_details,
        training_status: status,
        learning_rate: typeof item.learning_rate === "number" ? item.learning_rate : undefined,
        batch_size: typeof item.batch_size === "number" ? item.batch_size : undefined,
        default_epochs: typeof item.default_epochs === "number" ? item.default_epochs : undefined,
      };
    });
  } catch (err: unknown) {
    logger.warn("Training Suite is unreachable; model catalog is empty", err);
    return [];
  }
}
