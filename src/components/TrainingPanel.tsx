import React, { useState, useEffect, useCallback, useRef } from "react";
import { CloudTrainModal } from "./CloudTrainModal";
import { TrainingToolbar } from "./training/TrainingToolbar";
import { ModelManifoldCard } from "./training/ModelManifoldCard";
import { TrainingTelemetry } from "./training/TrainingTelemetry";
import { ValidationBanner } from "./common/ValidationBanner";
import { useStudioStore } from "../store/useStudioStore";
import {
  fetchModels,
  fetchRunningTrainingJobs,
  fetchTrainingJob,
  TERMINAL_JOB_STATUSES,
  fetchKaggleSuiteStatus,
} from "../api/client";
import { servicePort } from "../api/config";
import { ModelItem, KaggleSuiteStatus } from "../api/types";
import { errorMessage, logger } from "../utils/logger";
import { useTransientValue } from "../utils/useTransientValue";
import { useModelFilters } from "./training/useModelFilters";
import { TelemetryTab, useModelActions } from "./training/useModelActions";

/** Interval for polling the active local job's status on the training sidecar. */
const JOB_STATUS_POLL_MS = 3000;

interface TrainingPanelProps {
  trainingSuiteOnline: boolean;
  onOpenConfigEditor?: () => void;
  onStartTrainingSuite?: () => void;
  logSlot?: React.ReactNode;
}

export const TrainingPanel: React.FC<TrainingPanelProps> = ({
  trainingSuiteOnline,
  onStartTrainingSuite,
  logSlot,
}) => {
  // Narrow store selectors: the panel re-renders only for the slices it reads (never per telemetry event)
  const setCachedModels = useStudioStore((s) => s.setCachedModels);
  const localJob = useStudioStore((s) => s.localJob);
  const setLocalJob = useStudioStore((s) => s.setLocalJob);
  const setRemoteJob = useStudioStore((s) => s.setRemoteJob);

  // Only live sidecar data is shown: no offline placeholder catalog.
  const [models, setModels] = useState<ModelItem[]>(() => useStudioStore.getState().cachedModels);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshFeedback, showRefreshFeedback] = useTransientValue<string>(4000);

  // Status banners
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Pinned SOTA target details
  const [pinnedTargetModel, setPinnedTargetModel] = useState<string | null>(null);

  // Cloud modal state
  const [cloudModalModel, setCloudModalModel] = useState<ModelItem | null>(null);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState<boolean>(false);
  const [kaggleAuthStatus, setKaggleAuthStatus] = useState<KaggleSuiteStatus | null>(null);

  // Active telemetry tab: "local" | "remote" | "mesh"
  const [activeTelemetryTab, setActiveTelemetryTab] = useState<TelemetryTab>("local");

  const loadTrainingData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const modelList = await fetchModels();
      if (modelList.length > 0) {
        setModels(modelList);
        setCachedModels(modelList);
        showRefreshFeedback(`Loaded ${modelList.length} neural models from unified registry.`);
      } else {
        // Empty or unreachable sidecar: show the empty/offline state, never a hand-written catalog.
        setModels([]);
        showRefreshFeedback("Training sidecar returned no models. The catalog stays empty until it is reachable.");
      }
    } catch (err: unknown) {
      logger.warn("Training model registry fetch failed; catalog is empty", err);
      setModels([]);
      showRefreshFeedback(`Training sidecar unreachable (${errorMessage(err)}). The catalog stays empty until it is reachable.`);
    } finally {
      setIsRefreshing(false);
    }
  }, [setCachedModels, showRefreshFeedback]);

  const loadKaggleData = useCallback(async () => {
    try {
      const kStatus = await fetchKaggleSuiteStatus();
      setKaggleAuthStatus(kStatus);
    } catch (err: unknown) {
      logger.warn("Kaggle suite status could not be loaded", err);
    }
  }, []);

  // Initial load on mount only: a cache refresh must not re-run it (review finding D11)
  useEffect(() => {
    if (useStudioStore.getState().cachedModels.length === 0) {
      void loadTrainingData();
    }
    void loadKaggleData();
  }, [loadTrainingData, loadKaggleData]);

  // Refetch when the training sidecar comes back online (offline -> online transition)
  const prevTrainingOnlineRef = useRef<boolean>(trainingSuiteOnline);
  useEffect(() => {
    const wasOnline = prevTrainingOnlineRef.current;
    prevTrainingOnlineRef.current = trainingSuiteOnline;
    if (trainingSuiteOnline && !wasOnline) {
      loadTrainingData();
      loadKaggleData();
    }
  }, [trainingSuiteOnline, loadTrainingData, loadKaggleData]);

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
          // Strictly look for active training jobs ("train") to avoid clobbering training state with background push/pull/eval
          const trainJobs = running.filter((j) => j.job_type === "train" || (!j.job_type && j.status === "running"));
          if (trainJobs.length > 0) {
            const active = trainJobs.find((j) => j.status === "running") || trainJobs[0];
            const activeKey = active.model_key || (active.params?.model as string) || null;
            setLocalJob({ jobId: active.id, modelKey: activeKey });
          }
        }
      } catch (err: unknown) {
        logger.warn("Running training jobs could not be listed", err);
      }
    };
    checkActiveJobs();
    return () => {
      isCancelled = true;
    };
  }, [setLocalJob]);

  // Periodic telemetry refresh while a local job runs: one `with-stats` request per tick
  // (it carries every model's live metrics.csv telemetry), merged into the active model only.
  useEffect(() => {
    if (!localJob.modelKey) return;
    const activeKey = localJob.modelKey;

    const interval = setInterval(async () => {
      try {
        const fresh = (await fetchModels()).find((m) => m.key === activeKey);
        if (!fresh) return;
        setModels((prev) => prev.map((m) => (m.key === activeKey ? fresh : m)));
      } catch (err: unknown) {
        logger.debug(`Live telemetry refresh for ${activeKey} failed; retrying`, err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [localJob.modelKey]);

  // Clear the local job once the sidecar reports a terminal state (completed / failed / cancelled)
  useEffect(() => {
    const jobId = localJob.jobId;
    if (!jobId) return;
    let isCancelled = false;

    const pollJobStatus = async () => {
      try {
        const job = await fetchTrainingJob(jobId);
        if (isCancelled || !TERMINAL_JOB_STATUSES.has(job.status)) return;
        setLocalJob({ jobId: null, modelKey: null });
        if (job.status === "failed") {
          setStatusError(`Local training job ${jobId} failed${job.error_message ? `: ${job.error_message}` : "."}`);
        } else {
          setStatusNotice(`Local training job ${jobId} ${job.status}.`);
        }
      } catch (err: unknown) {
        logger.debug(`Polling status of training job ${jobId} failed; retrying`, err);
      }
    };

    const interval = setInterval(pollJobStatus, JOB_STATUS_POLL_MS);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [localJob.jobId, setLocalJob]);

  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    archFilter,
    setArchFilter,
    uniqueCategories,
    uniqueArchitectures,
    filteredModels,
  } = useModelFilters(models);

  const {
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
  } = useModelActions({
    localJob,
    setLocalJob,
    setRemoteJob,
    setActiveTelemetryTab,
    setStatusNotice,
    setStatusError,
    loadTrainingData,
    loadKaggleData,
    kaggleUsername: kaggleAuthStatus?.username,
  });

  const handleOpenCloudModal = (m: ModelItem) => {
    setCloudModalModel(m);
    setIsCloudModalOpen(true);
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
              <strong style={{ color: "var(--accent-amber, #f59e0b)" }}>Training Suite Sidecar Offline (:{servicePort("training-suite")})</strong> — The model catalog, training status, ladders, and metrics come only from the sidecar and appear once it is reachable. Launch the sidecar to run live training passes, inspect GPU VRAM, or export ONNX weights.
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

      {statusError && (
        <ValidationBanner
          type="error"
          role="alert"
          message={statusError}
          onDismiss={() => setStatusError(null)}
          style={{ marginBottom: "16px" }}
        />
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

      {models.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }} data-testid="models-empty-state">
          <p style={{ fontSize: "14px", marginBottom: "8px" }}>
            {trainingSuiteOnline
              ? "The Training Suite returned no models."
              : "No models to show: the Training Suite sidecar is offline. Start it to load the model catalog."}
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => void loadTrainingData()} style={{ fontSize: "12px" }}>
            Retry
          </button>
        </div>
      )}

      {models.length > 0 && filteredModels.length === 0 && (
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
      <TrainingTelemetry
        activeTelemetryTab={activeTelemetryTab}
        onTabChange={setActiveTelemetryTab}
        onStopLocalTrain={handleStopLocalTrain}
        isStoppingLocal={actionBusyKey === "stopping"}
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
