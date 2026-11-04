/**
 * LemGendary AI Studio - per-model and fleet actions of the training panel:
 * local/cloud training, Kaggle sync, notebooks, evaluation, export, docs and staging.
 */

import { useState } from "react";
import {
  cancelTrainingJob,
  generateAllNotebooks,
  generateModelDocs,
  generateNotebooks,
  launchKaggleTrain,
  pullKaggleModelArtifacts,
  pushAllKaggleModels,
  pushKaggleModelArtifacts,
  stageModelVariations,
  triggerModelEvaluate,
  triggerModelExport,
  triggerQuickTrain,
} from "../../api/client";
import { ModelItem } from "../../api/types";
import { ActiveJobState } from "../../store/useStudioStore";

export type TelemetryTab = "local" | "remote" | "mesh";

export interface ModelActionDeps {
  localJob: ActiveJobState;
  setLocalJob: (job: ActiveJobState) => void;
  setRemoteJob: (job: ActiveJobState) => void;
  setActiveTelemetryTab: (tab: TelemetryTab) => void;
  setStatusNotice: (message: string | null) => void;
  setStatusError: (message: string | null) => void;
  loadTrainingData: () => Promise<void>;
  loadKaggleData: () => Promise<void>;
  kaggleUsername: string | undefined;
}

export function useModelActions({
  localJob,
  setLocalJob,
  setRemoteJob,
  setActiveTelemetryTab,
  setStatusNotice,
  setStatusError,
  loadTrainingData,
  loadKaggleData,
  kaggleUsername,
}: ModelActionDeps) {
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [generatingNotebookModel, setGeneratingNotebookModel] = useState<string | null>(null);
  const [isGeneratingAllNotebooks, setIsGeneratingAllNotebooks] = useState<boolean>(false);
  const [isPushingAllKaggle, setIsPushingAllKaggle] = useState<boolean>(false);

  const handleStartLocalTrain = async (m: ModelItem, batchSize?: number) => {
    setActionBusyKey(`local_${m.key}`);
    try {
      const res = await triggerQuickTrain({ model_key: m.key, batch_size: batchSize });
      setLocalJob({ jobId: res.job_id || null, modelKey: m.key });
      setActiveTelemetryTab("local");
      setStatusNotice(`Local training initialized for ${m.display_name} (Batch: ${batchSize ?? m.batch_size ?? "Auto"}, Job ID: ${res.job_id || "started"}). Telemetry stream active.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Failed to start local training for ${m.display_name}: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleStopLocalTrain = async () => {
    if (!localJob.jobId) return;
    const jobId = localJob.jobId;
    setActionBusyKey("stopping");
    setStatusError(null);
    try {
      // Resolves only after the sidecar confirms status "cancelled"; job state is kept otherwise.
      await cancelTrainingJob(jobId);
      setStatusNotice(`Cancelled local training job ${jobId}.`);
      setLocalJob({ jobId: null, modelKey: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusError(`Failed to stop job ${jobId}: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleLaunchKaggle = async (modelKey: string, gpu: "T4" | "P100", autoPull: boolean) => {
    setActionBusyKey(`cloud_${modelKey}`);
    try {
      const res = await launchKaggleTrain({
        model: modelKey,
        gpu,
        auto_pull: autoPull,
        username: kaggleUsername || undefined,
      });
      setRemoteJob({ jobId: res.job_id, modelKey });
      setActiveTelemetryTab("remote");
      setStatusNotice(`Dispatched Kaggle training for ${modelKey} (Kernel: ${res.job_id}). Stream attached.`);
      await loadKaggleData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Failed to dispatch Kaggle training: ${msg}`);
      throw err;
    } finally {
      setActionBusyKey(null);
    }
  };

  const handlePushArtifacts = async (modelKey: string) => {
    setActionBusyKey(`push_${modelKey}`);
    setActiveTelemetryTab("local");
    try {
      const res = await pushKaggleModelArtifacts(modelKey);
      setStatusNotice(`Kaggle push enqueued for ${modelKey} (Job ID: ${res.job_id}). Local telemetry streaming.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Failed pushing artifacts for ${modelKey}: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handlePullArtifacts = async (modelKey: string) => {
    setActionBusyKey(`pull_${modelKey}`);
    setActiveTelemetryTab("local");
    try {
      const res = await pullKaggleModelArtifacts(modelKey);
      setStatusNotice(`Kaggle pull enqueued for ${modelKey} (Job ID: ${res.job_id}). Local telemetry streaming.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Failed pulling model for ${modelKey}: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleGenerateTrainingNotebook = async (modelKey: string) => {
    setGeneratingNotebookModel(`${modelKey}_training`);
    try {
      await generateNotebooks({ model_key: modelKey, kinds: ["training"] });
      setStatusNotice(`Successfully regenerated training notebooks for ${modelKey}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Failed to generate training notebooks: ${msg}`);
    } finally {
      setGeneratingNotebookModel(null);
    }
  };

  const handleGenerateUsageNotebook = async (modelKey: string) => {
    setGeneratingNotebookModel(`${modelKey}_usage`);
    try {
      await generateNotebooks({ model_key: modelKey, kinds: ["usage"] });
      setStatusNotice(`Successfully regenerated standalone usage guide notebook for ${modelKey}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Failed to generate usage guide notebook: ${msg}`);
    } finally {
      setGeneratingNotebookModel(null);
    }
  };

  const handleGenerateAllNotebooks = async () => {
    setIsGeneratingAllNotebooks(true);
    try {
      const res = await generateAllNotebooks("all");
      setStatusNotice(`Regenerated notebooks across all ${res.total_models} models (${res.total_files} files created).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Batch notebook generation failed: ${msg}`);
    } finally {
      setIsGeneratingAllNotebooks(false);
    }
  };

  const handleEvaluateModel = async (modelKey: string) => {
    setActionBusyKey(`eval_${modelKey}`);
    try {
      const res = await triggerModelEvaluate({ model: modelKey, env: "local" });
      setStatusNotice(`Evaluation dispatched for ${modelKey} (Job ID: ${res.job_id}). Local telemetry streaming below.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Evaluation failed for ${modelKey}: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleExportModel = async (modelKey: string) => {
    setActionBusyKey(`export_${modelKey}`);
    try {
      const res = await triggerModelExport({
        model: modelKey,
        targets: ["onnx_fp32", "onnx_fp16", "torch_pt"],
      });
      setStatusNotice(`Export dispatched for ${modelKey} (Job ID: ${res.job_id}). Artifacts written to LemGendaryModels.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Export failed for ${modelKey}: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleGenerateDocs = async (modelKey: string) => {
    setActionBusyKey(`docs_${modelKey}`);
    try {
      await generateModelDocs(modelKey);
      setStatusNotice(`Regenerated README.md and model-metadata.json for ${modelKey}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Docs generation failed for ${modelKey}: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleStageVariations = async (modelKey: string) => {
    setActionBusyKey(`stage_${modelKey}`);
    try {
      const res = await stageModelVariations(modelKey);
      const stagedCount = Object.keys(res.staged_files || {}).length;
      setStatusNotice(`Staged ${stagedCount} isolated variation binaries for ${modelKey}.`);
      await loadTrainingData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Staging failed for ${modelKey}: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handlePushAllKaggle = async () => {
    setIsPushingAllKaggle(true);
    setActiveTelemetryTab("local");
    try {
      const res = await pushAllKaggleModels({ variation: "all", dry_run: false });
      setStatusNotice(`Fleet Kaggle push enqueued for all models (Job ID: ${res.job_id}). Local telemetry streaming.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Failed to enqueue fleet Kaggle push: ${msg}`);
    } finally {
      setIsPushingAllKaggle(false);
    }
  };

  return {
    actionBusyKey,
    generatingNotebookModel,
    isGeneratingAllNotebooks,
    isPushingAllKaggle,
    handleStartLocalTrain,
    handleStopLocalTrain,
    handleLaunchKaggle,
    handlePushArtifacts,
    handlePullArtifacts,
    handleGenerateTrainingNotebook,
    handleGenerateUsageNotebook,
    handleGenerateAllNotebooks,
    handleEvaluateModel,
    handleExportModel,
    handleGenerateDocs,
    handleStageVariations,
    handlePushAllKaggle,
  };
}
