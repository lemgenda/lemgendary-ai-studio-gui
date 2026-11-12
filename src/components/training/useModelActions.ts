/**
 * LemGendary AI Studio - per-model and fleet actions of the training panel:
 * local/cloud training, Kaggle sync, notebooks, evaluation, export, docs and staging.
 */

import { useState } from "react";
import {
  blendModelSoup,
  cancelTrainingJob,
  generateAllNotebooks,
  generateModelDocs,
  generateNotebooks,
  launchKaggleTrain,
  monitorKaggleKernel,
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

  /** Drop the previous banner when a new action starts. */
  const clearStatus = () => {
    setStatusNotice(null);
    setStatusError(null);
  };
  /** Success goes to the green notice banner. */
  const reportSuccess = (message: string) => {
    setStatusError(null);
    setStatusNotice(message);
  };
  /** Failure goes to the red error banner, never the green notice banner. */
  const reportFailure = (context: string, err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    setStatusNotice(null);
    setStatusError(`${context}: ${msg}`);
  };

  const handleStartLocalTrain = async (m: ModelItem, batchSize?: number) => {
    setActionBusyKey(`local_${m.key}`);
    clearStatus();
    try {
      const res = await triggerQuickTrain({ model_key: m.key, batch_size: batchSize });
      setLocalJob({ jobId: res.job_id || null, modelKey: m.key });
      setActiveTelemetryTab("local");
      reportSuccess(`Local training initialized for ${m.display_name} (Batch: ${batchSize ?? m.batch_size ?? "Auto"}, Job ID: ${res.job_id || "started"}). Telemetry stream active.`);
    } catch (err: unknown) {
      reportFailure(`Failed to start local training for ${m.display_name}`, err);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleStopLocalTrain = async () => {
    if (!localJob.jobId) return;
    const jobId = localJob.jobId;
    setActionBusyKey("stopping");
    clearStatus();
    try {
      // Resolves only after the sidecar confirms status "cancelled"; job state is kept otherwise.
      await cancelTrainingJob(jobId);
      reportSuccess(`Cancelled local training job ${jobId}.`);
      setLocalJob({ jobId: null, modelKey: null });
    } catch (err: unknown) {
      reportFailure(`Failed to stop job ${jobId}`, err);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleLaunchKaggle = async (modelKey: string, gpu: "T4" | "P100", autoPull: boolean) => {
    setActionBusyKey(`cloud_${modelKey}`);
    clearStatus();
    try {
      const res = await launchKaggleTrain({
        model: modelKey,
        gpu,
        auto_pull: autoPull,
        username: kaggleUsername || undefined,
      });
      setRemoteJob({ jobId: res.job_id, modelKey });
      setActiveTelemetryTab("remote");
      reportSuccess(`Dispatched Kaggle training for ${modelKey} (Kernel: ${res.job_id}). Stream attached.`);
      await loadKaggleData();
    } catch (err: unknown) {
      reportFailure("Failed to dispatch Kaggle training", err);
      throw err;
    } finally {
      setActionBusyKey(null);
    }
  };

  /** Attach to a Kaggle kernel that is already running; its job is tracked like a launched one. */
  const handleMonitorKaggle = async (kernelSlug: string, modelKey: string, autoPull: boolean) => {
    setActionBusyKey(`cloud_${modelKey}`);
    clearStatus();
    try {
      const res = await monitorKaggleKernel({ kernel_slug: kernelSlug, model: modelKey, auto_pull: autoPull });
      setRemoteJob({ jobId: res.job_id, modelKey });
      setActiveTelemetryTab("remote");
      reportSuccess(`Monitoring Kaggle kernel ${res.kernel_slug} for ${modelKey} (Job ID: ${res.job_id}). Stream attached.`);
    } catch (err: unknown) {
      reportFailure(`Failed to monitor Kaggle kernel ${kernelSlug}`, err);
      throw err;
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleBlendSoup = async (modelKey: string) => {
    setActionBusyKey(`soup_${modelKey}`);
    clearStatus();
    try {
      const res = await blendModelSoup(modelKey);
      const donors = res.donors?.length ? ` from ${res.donors.length} checkpoint(s)` : "";
      reportSuccess(`Blended model soup for ${modelKey}${donors}: ${res.soup_checkpoint ?? "no checkpoint path reported"}.`);
      await loadTrainingData();
    } catch (err: unknown) {
      reportFailure(`Failed to blend model soup for ${modelKey}`, err);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handlePushArtifacts = async (modelKey: string) => {
    setActionBusyKey(`push_${modelKey}`);
    clearStatus();
    setActiveTelemetryTab("remote");
    try {
      const res = await pushKaggleModelArtifacts(modelKey);
      reportSuccess(`Kaggle push enqueued for ${modelKey} (Job ID: ${res.job_id}). Remote Cloud telemetry streaming.`);
    } catch (err: unknown) {
      reportFailure(`Failed pushing artifacts for ${modelKey}`, err);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handlePullArtifacts = async (modelKey: string) => {
    setActionBusyKey(`pull_${modelKey}`);
    clearStatus();
    setActiveTelemetryTab("remote");
    try {
      const res = await pullKaggleModelArtifacts(modelKey);
      reportSuccess(`Kaggle pull enqueued for ${modelKey} (Job ID: ${res.job_id}). Remote Cloud telemetry streaming.`);
    } catch (err: unknown) {
      reportFailure(`Failed pulling model for ${modelKey}`, err);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleGenerateTrainingNotebook = async (modelKey: string) => {
    setGeneratingNotebookModel(`${modelKey}_training`);
    clearStatus();
    try {
      await generateNotebooks({ model_key: modelKey, kinds: ["training"] });
      reportSuccess(`Successfully regenerated training notebooks for ${modelKey}.`);
    } catch (err: unknown) {
      reportFailure("Failed to generate training notebooks", err);
    } finally {
      setGeneratingNotebookModel(null);
    }
  };

  const handleGenerateUsageNotebook = async (modelKey: string) => {
    setGeneratingNotebookModel(`${modelKey}_usage`);
    clearStatus();
    try {
      await generateNotebooks({ model_key: modelKey, kinds: ["usage"] });
      reportSuccess(`Successfully regenerated standalone usage guide notebook for ${modelKey}.`);
    } catch (err: unknown) {
      reportFailure("Failed to generate usage guide notebook", err);
    } finally {
      setGeneratingNotebookModel(null);
    }
  };

  const handleGenerateAllNotebooks = async () => {
    setIsGeneratingAllNotebooks(true);
    clearStatus();
    try {
      const res = await generateAllNotebooks("all");
      reportSuccess(`Regenerated notebooks across all ${res.total_models} models (${res.total_files} files created).`);
    } catch (err: unknown) {
      reportFailure("Batch notebook generation failed", err);
    } finally {
      setIsGeneratingAllNotebooks(false);
    }
  };

  const handleEvaluateModel = async (modelKey: string) => {
    setActionBusyKey(`eval_${modelKey}`);
    clearStatus();
    try {
      const res = await triggerModelEvaluate({ model: modelKey, env: "local" });
      reportSuccess(`Evaluation dispatched for ${modelKey} (Job ID: ${res.job_id}). Local telemetry streaming below.`);
    } catch (err: unknown) {
      reportFailure(`Evaluation failed for ${modelKey}`, err);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleExportModel = async (modelKey: string) => {
    setActionBusyKey(`export_${modelKey}`);
    clearStatus();
    try {
      const res = await triggerModelExport({
        model: modelKey,
        targets: ["onnx_fp32", "onnx_fp16", "torch_pt"],
      });
      reportSuccess(`Export dispatched for ${modelKey} (Job ID: ${res.job_id}). Artifacts written to LemGendaryModels.`);
    } catch (err: unknown) {
      reportFailure(`Export failed for ${modelKey}`, err);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleGenerateDocs = async (modelKey: string) => {
    setActionBusyKey(`docs_${modelKey}`);
    clearStatus();
    try {
      await generateModelDocs(modelKey);
      reportSuccess(`Regenerated README.md and model-metadata.json for ${modelKey}.`);
    } catch (err: unknown) {
      reportFailure(`Docs generation failed for ${modelKey}`, err);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleStageVariations = async (modelKey: string) => {
    setActionBusyKey(`stage_${modelKey}`);
    clearStatus();
    try {
      const res = await stageModelVariations(modelKey);
      const stagedCount = Object.keys(res.staged_files || {}).length;
      reportSuccess(`Staged ${stagedCount} isolated variation binaries for ${modelKey}.`);
      await loadTrainingData();
    } catch (err: unknown) {
      reportFailure(`Staging failed for ${modelKey}`, err);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handlePushAllKaggle = async () => {
    setIsPushingAllKaggle(true);
    clearStatus();
    setActiveTelemetryTab("remote");
    try {
      const res = await pushAllKaggleModels({ variation: "all", dry_run: false });
      reportSuccess(`Fleet Kaggle push enqueued for all models (Job ID: ${res.job_id}). Remote Cloud telemetry streaming.`);
    } catch (err: unknown) {
      reportFailure("Failed to enqueue fleet Kaggle push", err);
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
    handleMonitorKaggle,
    handleBlendSoup,
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
