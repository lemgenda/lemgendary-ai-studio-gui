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
  trainLLM,
  triggerModelEvaluate,
  triggerModelExport,
  triggerQuickTrain,
} from "../../api/client";
import { ModelItem } from "../../api/types";
import { SoupRecipe } from "./soupRecipe";
import { ActiveJobState, TransferJobState } from "../../store/useStudioStore";
import { KaggleLaunchSettings, KaggleMonitorSettings } from "./KaggleLaunchOptions";
import { LocalTrainSettings } from "./localTrainSettings";

export type TelemetryTab = "local" | "remote" | "mesh";

export interface ModelActionDeps {
  localJob: ActiveJobState;
  setLocalJob: (job: ActiveJobState) => void;
  setRemoteJob: (job: ActiveJobState) => void;
  /** Tracks a card Push / Pull job so its outcome reaches the banner. */
  setTransferJob: (job: TransferJobState) => void;
  setActiveTelemetryTab: (tab: TelemetryTab) => void;
  setStatusNotice: (message: string | null) => void;
  setStatusError: (message: string | null) => void;
  loadTrainingData: () => Promise<void>;
  loadKaggleData: () => Promise<void>;
}

export function useModelActions({
  localJob,
  setLocalJob,
  setRemoteJob,
  setTransferJob,
  setActiveTelemetryTab,
  setStatusNotice,
  setStatusError,
  loadTrainingData,
  loadKaggleData,
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

  const handleStartLocalTrain = async (m: ModelItem, settings: LocalTrainSettings) => {
    const { batchSize, overrideFrozen } = settings;
    setActionBusyKey(`local_${m.key}`);
    clearStatus();
    try {
      // Assistant LLMs train through the dedicated QLoRA instruction-tuning route (no frozen override field).
      const res = m.is_llm
        ? await trainLLM({ model: m.key, batch_size: batchSize, env: "local" })
        : await triggerQuickTrain({ model_key: m.key, batch_size: batchSize, override_frozen: overrideFrozen });
      const mode = m.is_llm ? "QLoRA instruction tuning" : "Local training";
      setLocalJob({ jobId: res.job_id || null, modelKey: m.key });
      setActiveTelemetryTab("local");
      reportSuccess(`${mode} initialized for ${m.display_name} (Batch: ${batchSize ?? m.batch_size ?? "Auto"}, Job ID: ${res.job_id || "started"}). Telemetry stream active.`);
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

  /** Push the model's training kernel; the sidecar message names the accelerator it used. */
  const handleLaunchKaggle = async (modelKey: string, settings: KaggleLaunchSettings) => {
    setActionBusyKey(`cloud_${modelKey}`);
    clearStatus();
    try {
      const res = await launchKaggleTrain({
        model: modelKey,
        accelerator: settings.accelerator || undefined,
        auto_pull: settings.autoPull,
        poll_interval: settings.pollInterval,
        auto_resume: settings.autoResume,
        max_resumes: settings.maxResumes ?? undefined,
        override_frozen: settings.overrideFrozen,
        ...settings.advanced,
      });
      setRemoteJob({ jobId: res.job_id, modelKey });
      setActiveTelemetryTab("remote");
      reportSuccess(`${res.message || `Dispatched Kaggle training for ${modelKey}`} (Job ID: ${res.job_id}). Stream attached.`);
      await loadKaggleData();
    } catch (err: unknown) {
      reportFailure("Failed to dispatch Kaggle training", err);
      throw err;
    } finally {
      setActionBusyKey(null);
    }
  };

  /** Attach to a Kaggle kernel that is already running; its job is tracked like a launched one. */
  const handleMonitorKaggle = async (kernelSlug: string, modelKey: string, settings: KaggleMonitorSettings) => {
    setActionBusyKey(`cloud_${modelKey}`);
    clearStatus();
    try {
      const res = await monitorKaggleKernel({
        kernel_slug: kernelSlug,
        model: modelKey,
        auto_pull: settings.autoPull,
        poll_interval: settings.pollInterval,
      });
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

  /** `recipe` null blends every vault checkpoint uniformly; resolves true on success. */
  const handleBlendSoup = async (modelKey: string, recipe: SoupRecipe | null): Promise<boolean> => {
    setActionBusyKey(`soup_${modelKey}`);
    clearStatus();
    try {
      const res = await blendModelSoup(modelKey, recipe ?? undefined);
      const donors = res.donors?.length ? ` from ${res.donors.length} checkpoint(s)` : "";
      reportSuccess(`Blended model soup for ${modelKey}${donors}: ${res.soup_checkpoint ?? "no checkpoint path reported"}.`);
      await loadTrainingData();
      return true;
    } catch (err: unknown) {
      reportFailure(`Failed to blend model soup for ${modelKey}`, err);
      return false;
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
      setTransferJob({ jobId: res.job_id, modelKey, jobType: "kaggle_push" });
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
      setTransferJob({ jobId: res.job_id, modelKey, jobType: "kaggle_pull" });
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
