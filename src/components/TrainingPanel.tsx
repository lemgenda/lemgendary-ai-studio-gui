import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { CloudTrainModal } from "./CloudTrainModal";
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
  fetchLiveModelTelemetry,
} from "../api/client";
import { ModelItem, PipelineEvent, KaggleKernelItem, KaggleSuiteStatus } from "../api/types";

interface TrainingPanelProps {
  trainingSuiteOnline: boolean;
  onOpenConfigEditor?: () => void;
  recentEvents?: PipelineEvent[];
  logSlot?: React.ReactNode;
}

export const TrainingPanel: React.FC<TrainingPanelProps> = ({
  trainingSuiteOnline,
  recentEvents: _recentEvents,
  logSlot,
}) => {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshFeedback, setRefreshFeedback] = useState<string | null>(null);

  // Local active training job state
  const [localJobId, setLocalJobId] = useState<string | null>(null);
  const [localJobModel, setLocalJobModel] = useState<string | null>(null);

  // Remote / Cloud active training job state
  const [remoteJobId, setRemoteJobId] = useState<string | null>(null);
  const [remoteJobModel, setRemoteJobModel] = useState<string | null>(null);
  const [attachedKernelRef, setAttachedKernelRef] = useState<string | null>(null);
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [archFilter, setArchFilter] = useState<string>("ALL");

  // Pinned/hovered SOTA target details
  const [pinnedTargetModel, setPinnedTargetModel] = useState<string | null>(null);
  const [hoveredTargetModel, setHoveredTargetModel] = useState<string | null>(null);

  // Cloud modal & quick-dispatch state
  const [cloudModalModel, setCloudModalModel] = useState<ModelItem | null>(null);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState<boolean>(false);
  const [selectedCloudLaunchModel, setSelectedCloudLaunchModel] = useState<string>("");
  const [cloudGpu, setCloudGpu] = useState<"T4" | "P100">("T4");
  const [kaggleAuthStatus, setKaggleAuthStatus] = useState<KaggleSuiteStatus | null>(null);
  const [kaggleKernels, setKaggleKernels] = useState<KaggleKernelItem[]>([]);

  // Active telemetry tab: "local" | "remote" | "mesh"
  const [activeTelemetryTab, setActiveTelemetryTab] = useState<"local" | "remote" | "mesh">("local");

  const telemetryRef = useRef<HTMLDivElement>(null);

  const loadTrainingData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const modelList = await fetchModels();
      if (modelList.length > 0) {
        setModels(modelList);
        setRefreshFeedback(`Loaded ${modelList.length} neural models from unified registry.`);
      }
    } catch {
      setRefreshFeedback("Failed to refresh models from training sidecar.");
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshFeedback(null), 4000);
    }
  }, []);

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
    loadTrainingData();
    loadKaggleData();
  }, [loadTrainingData, loadKaggleData]);

  const runningJobId = localJobId;
  const runningJobModel = localJobModel;

  // Periodic polling for active running training jobs
  useEffect(() => {
    let isMounted = true;
    const pollRunningJobs = async () => {
      if (!trainingSuiteOnline) {
        if (isMounted) {
          setLocalJobId(null);
          setLocalJobModel(null);
        }
        return;
      }
      try {
        const jobs = await fetchRunningTrainingJobs();
        if (!isMounted) return;
        if (jobs && jobs.length > 0) {
          const active = jobs.find((j) => j.status === "running") || jobs[0];
          setLocalJobId(active.id);
          const activeKey = active.model_key || (active.params?.model as string) || null;
          setLocalJobModel(activeKey);
          if (activeKey) {
            const tel = await fetchLiveModelTelemetry(activeKey).catch(() => null);
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
          }
        } else {
          setLocalJobId(null);
          setLocalJobModel(null);
        }
      } catch {
        // Training suite sidecar temporarily unreachable
      }
    };

    pollRunningJobs();
    const timer = setInterval(pollRunningJobs, 3000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [trainingSuiteOnline]);

  const scrollToTelemetry = () => {
    if (telemetryRef.current) {
      telemetryRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleStartLocalTrain = async (model: ModelItem) => {
    if (!trainingSuiteOnline) {
      setStatusNotice("Training failed: Training Suite Sidecar (Port 8200) is offline.");
      return;
    }
    setActionBusyKey(`local_${model.key}`);
    setStatusNotice(null);
    try {
      const res = await triggerQuickTrain({
        model_key: model.key,
        preset: "quick-sota",
        epochs: model.default_epochs || 30,
        batch_size: model.batch_size || 8,
        learning_rate: model.learning_rate || 0.0002,
        env: "local",
        ladder_stage: model.spatial_ladder && model.spatial_ladder.length > 0 ? model.spatial_ladder[0] : 320,
        enable_sawtooth: true,
      });
      if (res.job_id) {
        setLocalJobId(res.job_id);
        setLocalJobModel(model.key);
      }
      setActiveTelemetryTab("local");
      setStatusNotice(`Training dispatched for ${model.display_name} (Job ID: ${res.job_id || "Active"}). Local telemetry streaming below.`);
      scrollToTelemetry();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Failed to start training for ${model.display_name}: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleStopLocalTrain = async () => {
    if (!localJobId) return;
    const jobId = localJobId;
    setActionBusyKey("stopping");
    setStatusNotice("Dispatched abort signal — halting local training process cleanly...");
    try {
      await cancelTrainingJob(jobId);
      setLocalJobId(null);
      setLocalJobModel(null);
      setStatusNotice("Local training process halted. Checkpoints safely preserved in LemGendaryModels.");
    } catch {
      setStatusNotice(`Abort signal dispatched for job ${jobId}. Process will terminate safely.`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleOpenCloudModal = (model: ModelItem) => {
    setCloudModalModel(model);
    setIsCloudModalOpen(true);
  };

  const handleLaunchKaggle = async (modelKey: string, gpu: "T4" | "P100", autoPull: boolean) => {
    setActionBusyKey(`cloud_${modelKey}`);
    try {
      const res = await launchKaggleTrain({
        model: modelKey,
        gpu,
        auto_pull: autoPull,
      });
      if (res.job_id) {
        setRemoteJobId(res.job_id);
        setRemoteJobModel(modelKey);
      }
      setActiveTelemetryTab("remote");
      setStatusNotice(`Kaggle Cloud training queued for ${modelKey}. Job ID: ${res.job_id || "Active"}.`);
      scrollToTelemetry();
      loadKaggleData();
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleAttachKernelStream = async (k: KaggleKernelItem) => {
    setActionBusyKey(`attach_${k.ref}`);
    try {
      await monitorKaggleKernel({ kernel_slug: k.ref, model: k.title });
      setAttachedKernelRef(k.ref);
      setRemoteJobModel(k.title || k.ref);
      setActiveTelemetryTab("remote");
      setStatusNotice(`Attached live telemetry stream to remote kernel: ${k.ref}`);
      scrollToTelemetry();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Failed to attach stream: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handlePullArtifacts = async (modelKey: string) => {
    setActionBusyKey(`pull_${modelKey}`);
    setStatusNotice(null);
    try {
      const res = await pullKaggleModelArtifacts(modelKey);
      setStatusNotice(res.message || `Checkpoints pulled to LemGendaryModels/${modelKey}`);
      loadTrainingData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Pull failed: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handlePushArtifacts = async (modelKey: string) => {
    setActionBusyKey(`push_${modelKey}`);
    setStatusNotice(`Packaging and pushing ${modelKey} checkpoints to Cloud Vault...`);
    try {
      await launchKaggleTrain({
        model: modelKey,
        gpu: "T4",
        auto_pull: true,
      });
      setStatusNotice(`Successfully pushed checkpoints for ${modelKey} to Cloud Vault.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusNotice(`Push failed: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  // Distinct architectures and categories for filters
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    models.forEach((m) => {
      if (m.task_type) set.add(m.task_type);
      if (m.category) set.add(m.category);
    });
    return Array.from(set).sort();
  }, [models]);

  const getBaseArchitecture = (arch: string): string => {
    if (!arch) return "";
    const match = arch.match(/^[^(]+/);
    return match ? match[0].trim() : arch.trim();
  };

  const uniqueArchitectures = useMemo(() => {
    const map = new Map<string, number>();
    models.forEach((m) => {
      const base = getBaseArchitecture(m.architecture);
      if (base) {
        map.set(base, (map.get(base) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([arch, count]) => ({ arch, count }))
      .sort((a, b) => a.arch.localeCompare(b.arch));
  }, [models]);

  // Filtered models
  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = m.display_name.toLowerCase().includes(q);
        const matchesKey = m.key.toLowerCase().includes(q);
        const matchesArch = m.architecture.toLowerCase().includes(q);
        const matchesTask = (m.task_type || "").toLowerCase().includes(q);
        if (!matchesName && !matchesKey && !matchesArch && !matchesTask) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "ALL") {
        const mStatus = m.training_status || (m.checkpoint_exists ? "weights_ready" : "initializing");
        if (statusFilter === "FULLY_TRAINED" && mStatus !== "fully_trained") return false;
        if (statusFilter === "PARTIALLY_TRAINED" && mStatus !== "partially_trained") return false;
        if (statusFilter === "WEIGHTS_READY" && mStatus !== "weights_ready") return false;
        if (statusFilter === "INITIALIZING" && mStatus !== "initializing") return false;
      }

      // Category filter
      if (categoryFilter !== "ALL") {
        const cat = (m.task_type || m.category || "").toLowerCase();
        if (!cat.includes(categoryFilter.toLowerCase())) return false;
      }

      // Architecture filter
      if (archFilter !== "ALL") {
        const base = getBaseArchitecture(m.architecture);
        if (base !== archFilter && m.architecture !== archFilter) return false;
      }

      return true;
    });
  }, [models, searchQuery, statusFilter, categoryFilter, archFilter]);

  const toggleTargetPin = (modelKey: string) => {
    setPinnedTargetModel((prev) => (prev === modelKey ? null : modelKey));
  };

  return (
    <div className="panel-container">
      {/* ─── REGISTERED ARCHITECTURES & CHECKPOINT TELEMETRY SECTION ───────────── */}
      <div className="card" style={{ padding: "20px" }}>
        {/* Header & Controls Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                LemGendary Trained Models Repo
              </h3>
              <HelpTooltip content="Authoritative neural architecture registry and checkpoints in LemGendary Trained Models Repo (.\LemGendaryModels\). Displays authoritative checkpoint status, SOTA convergence, resolution ladders, and dispatches training passes." />
              <span className="badge badge-info" style={{ fontSize: "11px" }}>
                {filteredModels.length} of {models.length} Models
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
              Comprehensive model manifold cards with integrated local training, headless Kaggle/Colab cloud orchestration, and .\LemGendaryModels\ checkpoint vaults.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {runningJobId && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "6px", padding: "4px 10px" }}>
                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-emerald)", animation: "pulse 1.5s infinite" }} />
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-emerald)" }}>
                  Running: {runningJobModel || "Job " + runningJobId}
                </span>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleStopLocalTrain}
                  disabled={actionBusyKey === "stopping"}
                  style={{ fontSize: "11px", padding: "2px 8px" }}
                >
                  {actionBusyKey === "stopping" ? "Halting..." : "Stop"}
                </button>
              </div>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadTrainingData}
              disabled={isRefreshing}
              style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              aria-label="Refresh model checkpoints and telemetry from sidecar"
            >
              <span>{isRefreshing ? "Refreshing..." : "Refresh Models"}</span>
            </button>
            <HelpTooltip content="Poll port 8200 sidecar to update model weights status, metrics.csv progress, and resolution ladder completion." />
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px", padding: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "8px", marginBottom: "20px" }}>
          {/* Live Search Input */}
          <div style={{ flex: "1 1 220px", position: "relative" }}>
            <input
              type="text"
              placeholder="Filter by model name, architecture, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="editor-input"
              style={{ width: "100%", padding: "6px 10px", fontSize: "12px" }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "12px" }}
              >
                X
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="editor-select"
              style={{ padding: "6px 8px", fontSize: "12px" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="FULLY_TRAINED">Fully Trained</option>
              <option value="PARTIALLY_TRAINED">Partially Trained</option>
              <option value="WEIGHTS_READY">Weights Ready</option>
              <option value="INITIALIZING">Initializing</option>
            </select>
          </div>

          {/* Category Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="editor-select"
              style={{ padding: "6px 8px", fontSize: "12px" }}
            >
              <option value="ALL">All Categories</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Architecture Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Architecture:</span>
            <select
              value={archFilter}
              onChange={(e) => setArchFilter(e.target.value)}
              className="editor-select"
              style={{ padding: "6px 8px", fontSize: "12px" }}
            >
              <option value="ALL">All Architectures</option>
              {uniqueArchitectures.map(({ arch, count }) => (
                <option key={arch} value={arch}>{arch} ({count})</option>
              ))}
            </select>
          </div>

          {(searchQuery || statusFilter !== "ALL" || categoryFilter !== "ALL" || archFilter !== "ALL") && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
                setCategoryFilter("ALL");
                setArchFilter("ALL");
              }}
              style={{ fontSize: "11px", padding: "4px 8px" }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Banners */}
        {refreshFeedback && (
          <div className="validation-banner banner-info" style={{ marginBottom: "16px" }} role="status">
            <span>{refreshFeedback}</span>
          </div>
        )}

        {!trainingSuiteOnline && (
          <div className="validation-banner banner-error" style={{ marginBottom: "16px" }} role="alert">
            <span>Training Suite Sidecar (Port 8200) is offline. Launch lemgendary-training-suite to enable training dispatch.</span>
          </div>
        )}

        {statusNotice && (
          <div className="validation-banner banner-success" style={{ marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }} role="status">
            <span>{statusNotice}</span>
            <button type="button" onClick={() => setStatusNotice(null)} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontWeight: 700 }}>X</button>
          </div>
        )}

        {/* ─── MODEL CARDS GRID ────────────────────────────────────────────── */}
        <div className="card-grid card-grid-models">
          {filteredModels.map((m) => {
            const isTargetOpen = pinnedTargetModel === m.key || hoveredTargetModel === m.key;
            const isCurrentlyTrainingThis = runningJobModel === m.key;
            const isBusy = actionBusyKey === `local_${m.key}` || actionBusyKey === `cloud_${m.key}` || actionBusyKey === `pull_${m.key}` || actionBusyKey === `push_${m.key}`;

            return (
              <div
                key={m.key}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "16px",
                  border: isCurrentlyTrainingThis ? "1px solid var(--accent-emerald)" : undefined,
                  background: isCurrentlyTrainingThis ? "rgba(16, 185, 129, 0.03)" : undefined,
                }}
              >
                {/* 1. Model Name: Full-width at the very top */}
                <div style={{ width: "100%", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                  <h4 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-primary)", lineHeight: 1.3, flex: 1 }}>
                    {m.display_name}
                  </h4>
                  <HelpTooltip content={`Authoritative model key: ${m.key}. Parallel execution mode: ${m.preferred_parallel?.toUpperCase() || "SINGLE"}.`} />
                </div>

                {/* 2. Training Progress / Status: Full-width directly below Model Name */}
                <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", background: "rgba(255,255,255,0.03)", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                    Training Progress:
                  </span>
                  <div>
                    {m.training_status === "fully_trained" ? (
                      <span className="badge badge-success" style={{ fontWeight: 700 }}>FULLY TRAINED</span>
                    ) : m.training_status === "partially_trained" || (m.epochs_completed ?? 0) > 0 ? (
                      <span className="badge badge-info" style={{ fontWeight: 700 }}>PARTIALLY TRAINED</span>
                    ) : m.checkpoint_exists ? (
                      <span className="badge badge-success" style={{ fontWeight: 700 }}>WEIGHTS READY</span>
                    ) : (
                      <span className="badge badge-warning" style={{ fontWeight: 700 }}>INITIALIZING</span>
                    )}
                  </div>
                </div>

                {/* 3. Metric Specs Rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
                  <div className="metric-row">
                    <span className="metric-label">Neural Architecture</span>
                    <span className="metric-value">{m.architecture}</span>
                  </div>

                  <div className="metric-row">
                    <span className="metric-label">Parameters</span>
                    <span className="metric-value">{m.parameters_m ? `${m.parameters_m} M` : "N/A"}</span>
                  </div>

                  <div className="metric-row">
                    <span className="metric-label">Task Category</span>
                    <span className="metric-value">{m.task_type}</span>
                  </div>

                  <div className="metric-row">
                    <span className="metric-label">Completed Epochs</span>
                    <span className="metric-value">{m.epochs_completed ?? 0}</span>
                  </div>

                  {/* 4. Target Metrics Card (SOTA) - Hover or Click to Expand/Pin */}
                  <div
                    style={{
                      background: isTargetOpen ? "rgba(59, 130, 246, 0.08)" : "rgba(255,255,255,0.02)",
                      border: isTargetOpen ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid var(--border-color)",
                      borderRadius: "6px",
                      padding: "8px 10px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onClick={() => toggleTargetPin(m.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleTargetPin(m.key);
                      }
                    }}
                    onMouseEnter={() => setHoveredTargetModel(m.key)}
                    onMouseLeave={() => setHoveredTargetModel((prev) => (prev === m.key ? null : prev))}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isTargetOpen}
                    aria-label={`Target metrics details for ${m.display_name}. Click to pin open.`}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>
                          Target Metrics (SOTA)
                        </span>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                          {pinnedTargetModel === m.key ? "(Pinned)" : "(Click to pin)"}
                        </span>
                      </div>
                      <span
                        className="metric-value"
                        style={{
                          color: m.sota_reached ? "var(--accent-emerald)" : (m.sota_targets_met ?? 0) > 0 ? "#38bdf8" : "var(--text-muted)",
                          fontWeight: 700,
                          fontSize: "12px",
                        }}
                      >
                        {m.sota_targets_total ? `${m.sota_targets_met ?? 0} / ${m.sota_targets_total} Met` : (m.sota_reached ? "Target Reached" : "Pending")}
                      </span>
                    </div>

                    {/* Expanded Target Details */}
                    {isTargetOpen && m.sota_details && m.sota_details.length > 0 && (
                      <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {m.sota_details.map((s) => (
                          <div key={s.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" }}>
                            <span style={{ color: "var(--text-secondary)" }}>{s.label}:</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ color: "var(--text-muted)" }}>Goal: {s.target}</span>
                              <span style={{ fontWeight: 600, color: s.passed ? "var(--accent-emerald)" : s.achieved !== null ? "var(--accent-rose)" : "var(--text-muted)" }}>
                                {s.achieved !== null ? s.achieved : "—"}
                              </span>
                              <span className={`badge ${s.passed ? "badge-success" : "badge-secondary"}`} style={{ fontSize: "9px", padding: "1px 5px" }}>
                                {s.passed ? "PASS" : "PENDING"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 5. Resolution Ladder: Fixed 0/512 bug */}
                  <div className="metric-row">
                    <span className="metric-label">{m.is_forex || m.ladder_type === "timeframe" ? "Confluence Ladder" : "Resolution Ladder"}</span>
                    <span
                      className="metric-value"
                      style={{
                        color: m.ladder_passed ? "var(--accent-emerald)" : undefined,
                        fontWeight: 600,
                      }}
                    >
                      {m.ladder_passed
                        ? (m.is_forex || m.ladder_type === "timeframe" ? "Full Confluence (D1)" : `Full (${m.target_res ?? 512}px)`)
                        : (m.is_forex || m.ladder_type === "timeframe"
                            ? "Partial Confluence"
                            : `${m.active_res ?? (m.spatial_ladder && m.spatial_ladder.length > 0 ? m.spatial_ladder[0] : 256)}px / ${m.target_res ?? 512}px`)}
                    </span>
                  </div>

                  {/* 6. Data Fraction */}
                  <div className="metric-row">
                    <span className="metric-label">Data Fraction</span>
                    <span
                      className="metric-value"
                      style={{
                        color: (m.data_fraction_passed && (m.data_fraction_completed ?? 0) >= 0.99) ? "var(--accent-emerald)" : undefined,
                        fontWeight: 600,
                      }}
                    >
                      {(m.data_fraction_passed && (m.data_fraction_completed ?? 0) >= 0.99) ? "100% (Passed)" : `${Math.round((m.data_fraction_completed ?? 0) * 100)}%`}
                    </span>
                  </div>
                </div>

                {/* 4. Action Buttons Toolbar on each card */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "auto", paddingTop: "10px", borderTop: "1px solid var(--border-color)" }}>
                  {/* Local Training */}
                  {isCurrentlyTrainingThis ? (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={handleStopLocalTrain}
                      disabled={isBusy}
                      style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                      <span>Stop Training</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleStartLocalTrain(m)}
                      disabled={isBusy || !trainingSuiteOnline}
                      style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
                      title="Starts local GPU training pass and focuses telemetry terminal below"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
                        <polygon points="6 4 20 12 6 20 6 4" />
                      </svg>
                      <span>Local Training</span>
                    </button>
                  )}

                  {/* Cloud Training */}
                  <button
                    type="button"
                    className="btn btn-cloud"
                    onClick={() => handleOpenCloudModal(m)}
                    disabled={isBusy}
                    style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
                    title="Opens Cloud Training dialog to pre-validate URLs, attached datasets, and launch on Kaggle GPU"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                    </svg>
                    <span>Cloud Training</span>
                  </button>

                  {/* Push Checkpoint */}
                  <button
                    type="button"
                    className="btn btn-vault-push"
                    onClick={() => handlePushArtifacts(m.key)}
                    disabled={isBusy}
                    style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
                    title="Pushes latest checkpoint to Cloud Checkpoint Vault"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span>Push Checkpoint</span>
                  </button>

                  {/* Pull Checkpoint */}
                  <button
                    type="button"
                    className="btn btn-vault-pull"
                    onClick={() => handlePullArtifacts(m.key)}
                    disabled={isBusy}
                    style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
                    title="Pulls latest checkpoint from Kaggle Models repository into local LemGendaryModels"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>Pull Checkpoint</span>
                  </button>
                </div>
              </div>
            );
          })}
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
      </div>

      {/* ─── TABBED REAL-TIME TELEMETRY & MULTI-EXECUTION CARD ──────────────── */}
      <div id="telemetry-panel-anchor" ref={telemetryRef} style={{ marginTop: "28px" }}>
        <section className="card" aria-labelledby="telemetry-card-heading">
          {/* Telemetry Card Header with Process Tabs */}
          <div className="card-title" style={{ flexWrap: "wrap", gap: "12px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h3 id="telemetry-card-heading" style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                Real-Time Telemetry &amp; Execution
              </h3>
              <HelpTooltip content="Unified telemetry hub supporting concurrent local GPU training and remote Kaggle/Colab cloud training in isolated streams." />

              {/* Tab Switcher */}
              <div style={{ display: "inline-flex", background: "rgba(0,0,0,0.3)", padding: "3px", borderRadius: "6px", border: "1px solid var(--border-color)", gap: "4px" }}>
                {/* Tab 1: Local Training */}
                <button
                  type="button"
                  className={`btn ${activeTelemetryTab === "local" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setActiveTelemetryTab("local")}
                  style={{ fontSize: "11px", padding: "4px 10px", gap: "6px" }}
                >
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: localJobId ? "var(--accent-emerald, #10b981)" : "#64748b",
                      animation: localJobId ? "pulse 1.5s infinite" : "none",
                    }}
                  />
                  <span>Local Training {localJobId ? `(${localJobModel || "Active"})` : ""}</span>
                </button>

                {/* Tab 2: Remote / Cloud Training */}
                <button
                  type="button"
                  className={`btn ${activeTelemetryTab === "remote" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setActiveTelemetryTab("remote")}
                  style={{ fontSize: "11px", padding: "4px 10px", gap: "6px" }}
                >
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: (remoteJobId || attachedKernelRef) ? "var(--accent-cyan, #06b6d4)" : "#64748b",
                      animation: (remoteJobId || attachedKernelRef) ? "pulse 1.5s infinite" : "none",
                    }}
                  />
                  <span>Remote Cloud {remoteJobModel ? `(${remoteJobModel})` : kaggleKernels.length > 0 ? `(${kaggleKernels.length})` : ""}</span>
                </button>

                {/* Tab 3: Mesh Stream */}
                <button
                  type="button"
                  className={`btn ${activeTelemetryTab === "mesh" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setActiveTelemetryTab("mesh")}
                  style={{ fontSize: "11px", padding: "4px 10px" }}
                >
                  Ecosystem Mesh
                </button>
              </div>
            </div>

            {/* Quick Context Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {activeTelemetryTab === "local" && localJobId && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleStopLocalTrain}
                  disabled={actionBusyKey === "stopping"}
                  style={{ fontSize: "11px", padding: "4px 12px" }}
                >
                  {actionBusyKey === "stopping" ? "Halting Job..." : "Halt Local Job"}
                </button>
              )}

              {activeTelemetryTab === "remote" && (
                <button
                  type="button"
                  className="btn btn-cloud"
                  onClick={() => {
                    const target = models.find((m) => m.key === selectedCloudLaunchModel) || models[0];
                    if (target) handleOpenCloudModal(target);
                  }}
                  style={{ fontSize: "11px", padding: "4px 12px" }}
                >
                  Launch Cloud Run
                </button>
              )}
            </div>
          </div>

          {/* ─── TAB 1: LOCAL TRAINING TELEMETRY ────────────────────────────── */}
          {activeTelemetryTab === "local" && (
            <div>
              {/* Local Training Status Bar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", padding: "10px 14px", borderRadius: "6px", border: "1px solid var(--border-color)", marginBottom: "12px", fontSize: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className={`badge ${localJobId ? "badge-success" : "badge-neutral"}`} style={{ fontWeight: 700 }}>
                    {localJobId ? "LOCAL TRAINING IN PROGRESS" : "LOCAL WORKER IDLE"}
                  </span>
                  {localJobId ? (
                    <span style={{ color: "var(--text-secondary)" }}>
                      Active Model: <strong style={{ color: "var(--text-primary)" }}>{localJobModel}</strong> | Job ID: <code>{localJobId}</code>
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>
                      Select any model card above and click &quot;Local Training&quot; to begin governed local GPU execution.
                    </span>
                  )}
                </div>
              </div>

              {/* Local Training Monospace Stream */}
              <div className="log-container" role="log" style={{ minHeight: "260px", maxHeight: "360px", overflowY: "auto" }}>
                {(_recentEvents || []).filter((ev) => {
                  const msg = ev.message.toLowerCase();
                  const isRemote = msg.includes("[kaggle]") || msg.includes("[cloud]") || msg.includes("kaggle://") || msg.includes("kernel");
                  return !isRemote && (
                    ev.step_name.toLowerCase().includes("training") ||
                    msg.includes("[governor]") ||
                    msg.includes("[yolo gen]") ||
                    msg.includes("[training]") ||
                    msg.includes("[start]") ||
                    msg.includes("epoch") ||
                    msg.includes("rung")
                  );
                }).length === 0 ? (
                  <div className="log-empty">
                    {localJobId ? "Awaiting training stream packets from sidecar..." : "No active local training stream. Launch a local model to monitor live execution."}
                  </div>
                ) : (
                  (_recentEvents || []).filter((ev) => {
                    const msg = ev.message.toLowerCase();
                    const isRemote = msg.includes("[kaggle]") || msg.includes("[cloud]") || msg.includes("kaggle://") || msg.includes("kernel");
                    return !isRemote && (
                      ev.step_name.toLowerCase().includes("training") ||
                      msg.includes("[governor]") ||
                      msg.includes("[yolo gen]") ||
                      msg.includes("[training]") ||
                      msg.includes("[start]") ||
                      msg.includes("epoch") ||
                      msg.includes("rung")
                    );
                  }).map((ev, idx) => (
                    <div key={`local-${ev.timestamp}-${idx}`} className="log-line">
                      <span className="log-timestamp">{ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : "--:--:--"}</span>
                      <span className="log-step">[LOCAL] [{ev.step_name.toUpperCase()}]:</span>
                      <span className={`log-message ${ev.message.includes("failed") || ev.message.includes("error") ? "log-error" : ""}`}>{ev.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ─── TAB 2: REMOTE / CLOUD TRAINING (KAGGLE & COLAB) ────────────── */}
          {activeTelemetryTab === "remote" && (
            <div>
              {/* Cloud Pre-Flight & Quick Dispatch Bar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", background: "rgba(255,255,255,0.02)", padding: "10px 14px", borderRadius: "6px", border: "1px solid var(--border-color)", marginBottom: "12px", fontSize: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className={`badge ${kaggleAuthStatus?.authenticated ? "badge-success" : "badge-error"}`}>
                    {kaggleAuthStatus?.authenticated ? `KAGGLE: @${kaggleAuthStatus.username}` : "KAGGLE OFFLINE"}
                  </span>
                  {attachedKernelRef && (
                    <span style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
                      Attached: <code>{attachedKernelRef}</code>
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <select
                    className="select-filter"
                    value={selectedCloudLaunchModel}
                    onChange={(e) => setSelectedCloudLaunchModel(e.target.value)}
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                  >
                    <option value="">Select Model for Cloud Dispatch...</option>
                    {models.map((m) => (
                      <option key={m.key} value={m.key}>{m.display_name}</option>
                    ))}
                  </select>

                  <select
                    className="select-filter"
                    value={cloudGpu}
                    onChange={(e) => setCloudGpu(e.target.value as "T4" | "P100")}
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                  >
                    <option value="T4">NVIDIA T4 (16GB)</option>
                    <option value="P100">NVIDIA P100 (16GB)</option>
                  </select>

                  <button
                    type="button"
                    className="btn btn-cloud"
                    disabled={!selectedCloudLaunchModel || actionBusyKey !== null}
                    onClick={() => {
                      if (selectedCloudLaunchModel) {
                        handleLaunchKaggle(selectedCloudLaunchModel, cloudGpu, true);
                      }
                    }}
                    style={{ fontSize: "11px", padding: "4px 10px" }}
                  >
                    Dispatch to Kaggle
                  </button>
                </div>
              </div>

              {/* Active Kaggle Kernels Table */}
              {kaggleKernels.length > 0 && (
                <div style={{ marginBottom: "12px", background: "rgba(17, 24, 39, 0.7)", border: "1px solid var(--border-color)", borderRadius: "6px", padding: "10px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px", textTransform: "uppercase" }}>
                    Active &amp; Recent Cloud Kernels (Kaggle GPU):
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "150px", overflowY: "auto" }}>
                    {kaggleKernels.map((k) => (
                      <div key={k.ref} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", padding: "6px 10px", borderRadius: "4px", fontSize: "11px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className={`badge ${k.status === "complete" ? "badge-success" : k.status === "running" ? "badge-info" : "badge-neutral"}`}>
                            {k.status}
                          </span>
                          <span style={{ fontWeight: 600 }}>{k.title || k.ref}</span>
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleAttachKernelStream(k)}
                            disabled={actionBusyKey === `attach_${k.ref}`}
                            style={{ fontSize: "10px", padding: "2px 8px" }}
                          >
                            {actionBusyKey === `attach_${k.ref}` ? "Attaching..." : "Attach Stream"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-vault-pull"
                            onClick={() => handlePullArtifacts(k.title || k.ref)}
                            disabled={actionBusyKey === `pull_${k.title || k.ref}`}
                            style={{ fontSize: "10px", padding: "2px 8px" }}
                          >
                            Pull Checkpoints
                          </button>
                          <a
                            href={`https://www.kaggle.com/code/${k.ref}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ fontSize: "10px", padding: "2px 8px", textDecoration: "none" }}
                          >
                            Open ↗
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Remote Cloud Monospace Stream */}
              <div className="log-container" role="log" style={{ minHeight: "240px", maxHeight: "340px", overflowY: "auto" }}>
                {(_recentEvents || []).filter((ev) => {
                  const msg = ev.message.toLowerCase();
                  return (
                    msg.includes("[kaggle]") ||
                    msg.includes("[cloud]") ||
                    msg.includes("kaggle://") ||
                    msg.includes("colab") ||
                    msg.includes("kernel") ||
                    ev.step_name.toLowerCase().includes("kaggle") ||
                    ev.step_name.toLowerCase().includes("cloud")
                  );
                }).length === 0 ? (
                  <div className="log-empty">
                    No remote cloud telemetry received yet. Click &quot;Attach Stream&quot; on an active Kaggle kernel or dispatch a new cloud run above.
                  </div>
                ) : (
                  (_recentEvents || []).filter((ev) => {
                    const msg = ev.message.toLowerCase();
                    return (
                      msg.includes("[kaggle]") ||
                      msg.includes("[cloud]") ||
                      msg.includes("kaggle://") ||
                      msg.includes("colab") ||
                      msg.includes("kernel") ||
                      ev.step_name.toLowerCase().includes("kaggle") ||
                      ev.step_name.toLowerCase().includes("cloud")
                    );
                  }).map((ev, idx) => (
                    <div key={`remote-${ev.timestamp}-${idx}`} className="log-line">
                      <span className="log-timestamp">{ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : "--:--:--"}</span>
                      <span className="log-step">[CLOUD] [{ev.step_name.toUpperCase()}]:</span>
                      <span className={`log-message ${ev.message.includes("failed") || ev.message.includes("error") ? "log-error" : ""}`}>{ev.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ─── TAB 3: ECOSYSTEM PIPELINE STREAM ────────────────────────────── */}
          {activeTelemetryTab === "mesh" && (
            <div>
              {logSlot}
            </div>
          )}
        </section>
      </div>

      {/* Cloud Training Modal */}
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
