import React, { useState, useEffect, useCallback, useMemo } from "react";
import { CloudTrainModal } from "./CloudTrainModal";
import { TrainingToolbar } from "./training/TrainingToolbar";
import { ModelManifoldCard } from "./training/ModelManifoldCard";
import { TelemetryConsole } from "./training/TelemetryConsole";
import { ValidationBanner } from "./common/ValidationBanner";
import { useStudioStore } from "../store/useStudioStore";
import {
  fetchModels,
  triggerQuickTrain,
  fetchRunningTrainingJobs,
  cancelTrainingJob,
  fetchKaggleSuiteStatus,
  fetchKaggleKernels,
  launchKaggleTrain,
  monitorKaggleKernel,
  pullKaggleModelArtifacts,
  pushKaggleModelArtifacts,
  fetchLiveModelTelemetry,
  generateNotebooks,
  triggerUnitTestAll,
  triggerModelEvaluate,
  triggerModelExport,
  generateAllNotebooks,
  generateModelDocs,
  stageModelVariations,
  pushAllKaggleModels,
} from "../api/client";
import { ModelItem, PipelineEvent, KaggleKernelItem, KaggleSuiteStatus } from "../api/types";
import { FALLBACK_MODELS } from "./training/fallbackModels";

interface TrainingPanelProps {
  trainingSuiteOnline: boolean;
  onOpenConfigEditor?: () => void;
  onStartTrainingSuite?: () => void;
  recentEvents?: PipelineEvent[];
  logSlot?: React.ReactNode;
}

export const TrainingPanel: React.FC<TrainingPanelProps> = ({
  trainingSuiteOnline,
  onStartTrainingSuite,
  recentEvents: _recentEvents,
  logSlot,
}) => {
  // Zustand State
  const {
    cachedModels,
    setCachedModels,
    localJob,
    setLocalJob,
    remoteJob,
    setRemoteJob,
  } = useStudioStore();

  const [models, setModels] = useState<ModelItem[]>(
    cachedModels.length > 0 ? cachedModels : FALLBACK_MODELS
  );
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshFeedback, setRefreshFeedback] = useState<string | null>(null);

  // Attached remote kernel & busy states
  const [attachedKernelRef, setAttachedKernelRef] = useState<string | null>(null);
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [generatingNotebookModel, setGeneratingNotebookModel] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isUnitTestRunning, setIsUnitTestRunning] = useState<boolean>(false);
  const [isGeneratingAllNotebooks, setIsGeneratingAllNotebooks] = useState<boolean>(false);
  const [isPushingAllKaggle, setIsPushingAllKaggle] = useState<boolean>(false);

  // Local & Remote telemetry stream isolation and clipboard controls
  const [localCopied, setLocalCopied] = useState<boolean>(false);
  const [clearedLocalTimestamp, setClearedLocalTimestamp] = useState<number>(0);
  const [remoteCopied, setRemoteCopied] = useState<boolean>(false);
  const [clearedRemoteTimestamp, setClearedRemoteTimestamp] = useState<number>(0);
  const [remoteEvents, setRemoteEvents] = useState<PipelineEvent[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [archFilter, setArchFilter] = useState<string>("ALL");

  // Pinned SOTA target details
  const [pinnedTargetModel, setPinnedTargetModel] = useState<string | null>(null);

  // Cloud modal & quick-dispatch state
  const [cloudModalModel, setCloudModalModel] = useState<ModelItem | null>(null);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState<boolean>(false);
  const [selectedCloudLaunchModel, setSelectedCloudLaunchModel] = useState<string>("");
  const [cloudGpu, setCloudGpu] = useState<"T4" | "P100">("T4");
  const [kaggleAuthStatus, setKaggleAuthStatus] = useState<KaggleSuiteStatus | null>(null);
  const [kaggleKernels, setKaggleKernels] = useState<KaggleKernelItem[]>([]);

  // Active telemetry tab: "local" | "remote" | "mesh"
  const [activeTelemetryTab, setActiveTelemetryTab] = useState<"local" | "remote" | "mesh">("local");

  const loadTrainingData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const modelList = await fetchModels();
      if (modelList.length > 0) {
        setModels(modelList);
        setCachedModels(modelList);
        setRefreshFeedback(`Loaded ${modelList.length} neural models from unified registry.`);
      } else {
        setModels(FALLBACK_MODELS);
        setCachedModels(FALLBACK_MODELS);
        setRefreshFeedback(`Loaded ${FALLBACK_MODELS.length} cached model architectures (Training Sidecar Offline).`);
      }
    } catch {
      setModels(FALLBACK_MODELS);
      setCachedModels(FALLBACK_MODELS);
      setRefreshFeedback("Training sidecar offline. Loaded cached model architecture catalog.");
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshFeedback(null), 4000);
    }
  }, [setCachedModels]);

  const loadKaggleData = useCallback(async () => {
    try {
      const [kStatus, kKernels] = await Promise.all([
        fetchKaggleSuiteStatus(),
        fetchKaggleKernels(),
      ]);
      setKaggleAuthStatus(kStatus);
      setKaggleKernels(kKernels);
    } catch {
      // Offline mode
    }
  }, []);

  useEffect(() => {
    if (cachedModels.length > 0) {
      setModels(cachedModels);
    } else {
      loadTrainingData();
    }
    loadKaggleData();
  }, [loadTrainingData, loadKaggleData, cachedModels]);

  // Sync Kaggle credentials on focus or secrets-updated
  useEffect(() => {
    const handleSync = () => {
      loadKaggleData();
    };
    window.addEventListener("secrets-updated", handleSync);
    window.addEventListener("focus", handleSync);
    return () => {
      window.removeEventListener("secrets-updated", handleSync);
      window.removeEventListener("focus", handleSync);
    };
  }, [loadKaggleData]);

  // Check active running jobs on mount
  useEffect(() => {
    let isCancelled = false;
    const checkActiveJobs = async () => {
      try {
        const running = await fetchRunningTrainingJobs();
        if (!isCancelled && running.length > 0) {
          const active = running.find((j) => j.status === "running") || running[0];
          const activeKey = active.model_key || (active.params?.model as string) || null;
          setLocalJob({ jobId: active.id, modelKey: activeKey });
        }
      } catch {
        // Ignored in offline mode
      }
    };
    checkActiveJobs();
    return () => {
      isCancelled = true;
    };
  }, [setLocalJob]);

  // Periodic polling for model telemetry when local job is running
  useEffect(() => {
    if (!localJob.modelKey) return;
    const activeKey = localJob.modelKey;

    const interval = setInterval(async () => {
      try {
        const tel = await fetchLiveModelTelemetry(activeKey);
        if (tel && (tel.latest_res !== null || tel.latest_data !== null)) {
          setModels((prev) =>
            prev.map((m) => {
              if (m.key !== activeKey) return m;
              const newRes = tel.latest_res ?? m.active_res;
              const newDataFraction = tel.latest_data ?? m.data_fraction_completed ?? 0;
              const newPassed = (newDataFraction >= 0.99 && m.ladder_passed) || Boolean(m.sota_reached);
              return {
                ...m,
                active_res: newRes,
                data_fraction_completed: newDataFraction,
                data_fraction_passed: newPassed,
                epochs_completed: Math.max(m.epochs_completed ?? 0, tel.latest_epoch ?? 0),
              };
            })
          );
        }
      } catch {
        // Ignored
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [localJob.modelKey]);

  // Derived filter options
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    models.forEach((m) => {
      if (m.category) cats.add(m.category);
    });
    return Array.from(cats).sort();
  }, [models]);

  const uniqueArchitectures = useMemo(() => {
    const archCounts: Record<string, number> = {};
    models.forEach((m) => {
      const arch = m.architecture || "Unknown";
      archCounts[arch] = (archCounts[arch] || 0) + 1;
    });
    return Object.entries(archCounts)
      .map(([arch, count]) => ({ arch, count }))
      .sort((a, b) => b.count - a.count);
  }, [models]);

  // Filtered models
  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = m.display_name.toLowerCase().includes(q) || m.key.toLowerCase().includes(q);
        const matchesArch = m.architecture.toLowerCase().includes(q);
        const matchesCat = (m.category || "").toLowerCase().includes(q);
        const matchesTask = (m.task_type || "").toLowerCase().includes(q);
        if (!matchesName && !matchesArch && !matchesCat && !matchesTask) return false;
      }
      if (statusFilter !== "ALL") {
        if (statusFilter === "FULLY_TRAINED" && m.training_status !== "fully_trained") return false;
        if (statusFilter === "PARTIALLY_TRAINED" && m.training_status !== "partially_trained" && (m.epochs_completed ?? 0) === 0) return false;
        if (statusFilter === "WEIGHTS_READY" && (!m.checkpoint_exists || m.training_status === "fully_trained")) return false;
        if (statusFilter === "INITIALIZING" && (m.training_status === "fully_trained" || m.checkpoint_exists || (m.epochs_completed ?? 0) > 0)) return false;
      }
      if (categoryFilter !== "ALL" && m.category !== categoryFilter) return false;
      if (archFilter !== "ALL" && m.architecture !== archFilter) return false;
      return true;
    });
  }, [models, searchQuery, statusFilter, categoryFilter, archFilter]);

  // Handlers
  const handleStartLocalTrain = async (m: ModelItem) => {
    setActionBusyKey(`local_${m.key}`);
    try {
      const res = await triggerQuickTrain({ model_key: m.key });
      setLocalJob({ jobId: res.job_id || null, modelKey: m.key });
      setActiveTelemetryTab("local");
      setStatusNotice(`Local training initialized for ${m.display_name} (Job ID: ${res.job_id || "started"}). Telemetry stream active.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Failed to start local training for ${m.display_name}: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleStopLocalTrain = async () => {
    if (!localJob.jobId) return;
    setActionBusyKey("stopping");
    try {
      await cancelTrainingJob(localJob.jobId);
      setStatusNotice(`Cancelled local training job ${localJob.jobId}.`);
      setLocalJob({ jobId: null, modelKey: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Failed to stop job: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleOpenCloudModal = (m: ModelItem) => {
    setCloudModalModel(m);
    setIsCloudModalOpen(true);
  };

  const handleLaunchKaggle = async (modelKey: string, gpu: "T4" | "P100", autoPull: boolean) => {
    setActionBusyKey(`cloud_${modelKey}`);
    try {
      const res = await launchKaggleTrain({
        model: modelKey,
        gpu,
        auto_pull: autoPull,
        username: kaggleAuthStatus?.username || undefined,
      });
      setRemoteJob({ jobId: res.job_id, modelKey });
      setAttachedKernelRef(res.job_id);
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
    try {
      const res = await pushKaggleModelArtifacts(modelKey);
      setStatusNotice(`Pushed checkpoints for ${modelKey}: ${res.message || "Success"}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Failed pushing artifacts for ${modelKey}: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handlePullArtifacts = async (modelKey: string) => {
    setActionBusyKey(`pull_${modelKey}`);
    try {
      const res = await pullKaggleModelArtifacts(modelKey);
      setStatusNotice(`Pulled checkpoints for ${modelKey}: ${res.message || "Success"}.`);
      await loadTrainingData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Failed pulling artifacts for ${modelKey}: ${msg}`);
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

  const handleRunUnitTestAll = async () => {
    setIsUnitTestRunning(true);
    try {
      const res = await triggerUnitTestAll({ epochs: 1, env: "local", force: false });
      setStatusNotice(`Fleet diagnostic pass dispatched (Job ID: ${res.job_id}).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Unit test suite execution failed: ${msg}`);
    } finally {
      setIsUnitTestRunning(false);
    }
  };

  const handlePushAllKaggle = async () => {
    setIsPushingAllKaggle(true);
    setActiveTelemetryTab("remote");
    try {
      const res = await pushAllKaggleModels({ variation: "all", dry_run: false });
      setRemoteJob({ jobId: res.job_id, modelKey: "all_models" });
      setStatusNotice(`Fleet Kaggle push enqueued for all models (Job ID: ${res.job_id}). Remote telemetry streaming.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Failed to enqueue fleet Kaggle push: ${msg}`);
    } finally {
      setIsPushingAllKaggle(false);
    }
  };

  const handleAttachKernelStream = async (k: KaggleKernelItem) => {
    setActionBusyKey(`attach_${k.ref}`);
    setAttachedKernelRef(k.ref);
    setActiveTelemetryTab("remote");
    try {
      const res = await monitorKaggleKernel({ kernel_slug: k.ref });
      setStatusNotice(`Attached stream to ${k.title || k.ref} (Status: ${res.status}).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Failed attaching stream: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const displayedLocalEvents = useMemo(() => {
    return (_recentEvents || []).filter(
      (ev) => !ev.timestamp || new Date(ev.timestamp).getTime() > clearedLocalTimestamp
    );
  }, [_recentEvents, clearedLocalTimestamp]);

  const displayedRemoteEvents = useMemo(() => {
    return remoteEvents.filter(
      (ev) => !ev.timestamp || new Date(ev.timestamp).getTime() > clearedRemoteTimestamp
    );
  }, [remoteEvents, clearedRemoteTimestamp]);

  // Clipboard & Clear Controls
  const handleCopyLocalStream = async () => {
    if (displayedLocalEvents.length === 0) return;
    const text = displayedLocalEvents
      .map((e) => {
        const timeStr = e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : "--:--:--";
        return `[${timeStr}] [${e.step_name}] ${e.message}`;
      })
      .join("\n");

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setLocalCopied(true);
      setTimeout(() => setLocalCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy local training stream logs:", err);
    }
  };

  const handleClearLocalStream = () => {
    setClearedLocalTimestamp(Date.now());
  };

  const handleCopyRemoteStream = async () => {
    if (displayedRemoteEvents.length === 0) return;
    const text = displayedRemoteEvents
      .map((e) => {
        const timeStr = e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : "--:--:--";
        return `[${timeStr}] [${e.step_name}] ${e.message}`;
      })
      .join("\n");

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setRemoteCopied(true);
      setTimeout(() => setRemoteCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy remote cloud stream logs:", err);
    }
  };

  const handleClearRemoteStream = () => {
    setClearedRemoteTimestamp(Date.now());
    setRemoteEvents([]);
  };

  return (
    <div style={{ padding: "20px 24px" }}>
      {/* 1. Toolbar */}
      <TrainingToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        archFilter={archFilter}
        onArchFilterChange={setArchFilter}
        uniqueCategories={uniqueCategories}
        uniqueArchitectures={uniqueArchitectures}
        onResetFilters={() => {
          setSearchQuery("");
          setStatusFilter("ALL");
          setCategoryFilter("ALL");
          setArchFilter("ALL");
        }}
        trainingSuiteOnline={trainingSuiteOnline}
        isUnitTestRunning={isUnitTestRunning}
        onRunUnitTestAll={handleRunUnitTestAll}
        isGeneratingAllNotebooks={isGeneratingAllNotebooks}
        onGenerateAllNotebooks={handleGenerateAllNotebooks}
        isPushingAllKaggle={isPushingAllKaggle}
        onPushAllKaggle={handlePushAllKaggle}
        isRefreshing={isRefreshing}
        onRefreshModels={loadTrainingData}
        totalModelsCount={models.length}
        filteredModelsCount={filteredModels.length}
      />

      {/* Notifications and Banners */}
      {refreshFeedback && (
        <ValidationBanner
          type="info"
          message={refreshFeedback}
          style={{ marginBottom: "16px" }}
        />
      )}

      {!trainingSuiteOnline && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            backgroundColor: "rgba(251, 146, 60, 0.12)",
            border: "1px solid var(--accent-amber, #f59e0b)",
            borderRadius: "var(--radius-sm)",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              className="status-indicator status-offline"
              style={{ width: "10px", height: "10px", flexShrink: 0 }}
              aria-label="Training Suite sidecar offline"
            />
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--accent-amber, #f59e0b)" }}>Training Suite Sidecar Offline (:8200)</strong> — Showing cached neural architecture registry ({models.length} models). Launch the sidecar to run live training passes, inspect GPU VRAM, or export ONNX weights.
            </span>
          </div>
          {onStartTrainingSuite && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: "12px", whiteSpace: "nowrap", flexShrink: 0 }}
              onClick={onStartTrainingSuite}
            >
              Start Training Suite
            </button>
          )}
        </div>
      )}

      {statusNotice && (
        <ValidationBanner
          type="success"
          message={statusNotice}
          onDismiss={() => setStatusNotice(null)}
          style={{ marginBottom: "16px" }}
        />
      )}

      {/* 2. Model Cards Grid */}
      <div className="card-grid" style={{ marginBottom: "24px" }}>
        {filteredModels.map((m) => (
          <ModelManifoldCard
            key={m.key}
            model={m}
            isCurrentlyTrainingThis={localJob.modelKey === m.key}
            isBusy={
              actionBusyKey === `local_${m.key}` ||
              actionBusyKey === `cloud_${m.key}` ||
              actionBusyKey === `pull_${m.key}` ||
              actionBusyKey === `push_${m.key}`
            }
            actionBusyKey={actionBusyKey}
            isTargetPinned={pinnedTargetModel === m.key}
            onToggleTargetPin={() => setPinnedTargetModel((prev) => (prev === m.key ? null : m.key))}
            generatingNotebookModel={generatingNotebookModel}
            onStartLocalTrain={handleStartLocalTrain}
            onStopLocalTrain={handleStopLocalTrain}
            onOpenCloudModal={handleOpenCloudModal}
            onPushArtifacts={handlePushArtifacts}
            onPullArtifacts={handlePullArtifacts}
            onGenerateTrainingNotebook={handleGenerateTrainingNotebook}
            onGenerateUsageNotebook={handleGenerateUsageNotebook}
            onEvaluateModel={handleEvaluateModel}
            onExportModel={handleExportModel}
            onGenerateDocs={handleGenerateDocs}
            onStageVariations={handleStageVariations}
            trainingSuiteOnline={trainingSuiteOnline}
          />
        ))}
      </div>

      {filteredModels.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
          <p style={{ fontSize: "14px", marginBottom: "8px" }}>No architectures matched your search or filter criteria.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("ALL");
              setCategoryFilter("ALL");
              setArchFilter("ALL");
            }}
            style={{ fontSize: "12px" }}
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* 3. Real-Time Telemetry & Multi-Execution Console */}
      <TelemetryConsole
        activeTelemetryTab={activeTelemetryTab}
        onTabChange={setActiveTelemetryTab}
        localJobId={localJob.jobId}
        localJobModel={localJob.modelKey}
        remoteJobId={remoteJob.jobId}
        remoteJobModel={remoteJob.modelKey}
        attachedKernelRef={attachedKernelRef}
        displayedLocalEvents={displayedLocalEvents}
        displayedRemoteEvents={displayedRemoteEvents}
        onCopyLocalStream={handleCopyLocalStream}
        localCopied={localCopied}
        onClearLocalStream={handleClearLocalStream}
        onStopLocalTrain={handleStopLocalTrain}
        isStoppingLocal={actionBusyKey === "stopping"}
        onCopyRemoteStream={handleCopyRemoteStream}
        remoteCopied={remoteCopied}
        onClearRemoteStream={handleClearRemoteStream}
        models={models}
        selectedCloudLaunchModel={selectedCloudLaunchModel}
        onSelectCloudLaunchModel={setSelectedCloudLaunchModel}
        cloudGpu={cloudGpu}
        onChangeCloudGpu={setCloudGpu}
        onLaunchCloudRun={() => {
          if (selectedCloudLaunchModel) {
            handleLaunchKaggle(selectedCloudLaunchModel, cloudGpu, true);
          }
        }}
        onOpenCloudModal={handleOpenCloudModal}
        kaggleAuthStatus={kaggleAuthStatus}
        kaggleKernels={kaggleKernels}
        onAttachKernelStream={handleAttachKernelStream}
        onPullKernelArtifacts={handlePullArtifacts}
        actionBusyKey={actionBusyKey}
        logSlot={logSlot}
      />

      {/* 4. Cloud Training Modal */}
      <CloudTrainModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        model={cloudModalModel}
        onLaunchKaggle={handleLaunchKaggle}
        kaggleAuthStatus={kaggleAuthStatus}
        isBusy={Boolean(actionBusyKey && actionBusyKey.startsWith("cloud_"))}
      />
    </div>
  );
};

export default TrainingPanel;
