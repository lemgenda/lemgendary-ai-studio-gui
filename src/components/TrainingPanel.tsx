import React, { useState, useEffect, useCallback, useMemo } from "react";
import { HelpTooltip } from "./HelpTooltip";
import {
  fetchModels,
  triggerQuickTrain,
} from "../api/client";
import { ModelItem } from "../api/types";

interface TrainingPanelProps {
  trainingSuiteOnline: boolean;
}

export const TrainingPanel: React.FC<TrainingPanelProps> = ({ trainingSuiteOnline }) => {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [epochs, setEpochs] = useState<number>(30);
  const [batchSize, setBatchSize] = useState<number>(8);
  const [learningRate, setLearningRate] = useState<number>(0.0002);
  const [selectedLadderStage, setSelectedLadderStage] = useState<number>(512);
  const [sawtoothGovernorActive, setSawtoothGovernorActive] = useState<boolean>(true);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [trainStatus, setTrainStatus] = useState<string | null>(null);
  const [refreshFeedback, setRefreshFeedback] = useState<string | null>(null);

  const applyModelDefaults = useCallback((modelKey: string, modelList: ModelItem[]) => {
    const m = modelList.find((item) => item.key === modelKey);
    if (!m) return;

    if (typeof m.default_epochs === "number" && m.default_epochs > 0) {
      setEpochs(m.default_epochs);
    } else if (modelKey === "yolov8n") {
      setEpochs(300);
    } else if (m.is_forex) {
      setEpochs(50);
    } else {
      setEpochs(30);
    }

    if (typeof m.batch_size === "number" && m.batch_size > 0) {
      setBatchSize(m.batch_size);
    } else if (modelKey === "yolov8n") {
      setBatchSize(16);
    } else if (m.is_forex) {
      setBatchSize(128);
    } else {
      setBatchSize(8);
    }

    if (typeof m.learning_rate === "number" && m.learning_rate > 0) {
      setLearningRate(m.learning_rate);
    } else if (modelKey === "yolov8n") {
      setLearningRate(0.01);
    } else if (m.is_forex) {
      setLearningRate(0.0001);
    } else {
      setLearningRate(0.0002);
    }

    const stages = m.spatial_ladder && m.spatial_ladder.length > 0
      ? m.spatial_ladder
      : (m.is_forex ? [1, 5, 15, 60, 240, 1440] : [256, 384, 512, 640]);
    setSelectedLadderStage(stages[stages.length - 1]);
  }, []);

  const loadTrainingData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const modelList = await fetchModels();
      if (modelList.length > 0) {
        setModels(modelList);
        setSelectedModel((prev) => {
          const nextKey = prev && modelList.some((m) => m.key === prev) ? prev : modelList[0].key;
          applyModelDefaults(nextKey, modelList);
          return nextKey;
        });
        setRefreshFeedback(`Loaded ${modelList.length} neural models from unified registry.`);
      } else {
        // Fallback default models from unified_models_v2.yaml
        const fallbackList: ModelItem[] = [
          { key: "nima_aesthetic_mobile", display_name: "NIMA Perceptual Aesthetics", architecture: "MobileNetV2-NIMA", task_type: "quality_assessment", canonical_format: "webdataset", parameters_m: 2.3, spatial_ladder: [224], checkpoint_exists: true, preferred_parallel: "ddp", epochs_completed: 30, best_metric: 0.65, metric_name: "SRCC", learning_rate: 0.0002, batch_size: 16, default_epochs: 30 },
          { key: "upn_v2", display_name: "Unified Perceptual Net V2", architecture: "ConvNeXt-V2-Base", task_type: "multi_modal_perception", canonical_format: "webdataset", parameters_m: 88.5, spatial_ladder: [128, 192, 256], checkpoint_exists: true, preferred_parallel: "ddp", epochs_completed: 45, best_metric: 0.05, metric_name: "MAE", learning_rate: 0.0001, batch_size: 8, default_epochs: 50 },
          { key: "film_restorer", display_name: "Film Restorer & Grain Synthesis", architecture: "NAFNet-Restoration", task_type: "image_restoration", canonical_format: "webdataset", parameters_m: 17.1, spatial_ladder: [256, 384, 512], checkpoint_exists: true, preferred_parallel: "ddp", epochs_completed: 60, best_metric: 24.0, metric_name: "PSNR (dB)", learning_rate: 0.0002, batch_size: 8, default_epochs: 60 },
          { key: "mirnet_exposure", display_name: "MIRNet Dual Residual Exposure", architecture: "MIRNet-v2", task_type: "low_light_enhancement", canonical_format: "webdataset", parameters_m: 31.8, spatial_ladder: [256, 384, 512], checkpoint_exists: true, preferred_parallel: "ddp", epochs_completed: 50, best_metric: 25.5, metric_name: "PSNR (dB)", learning_rate: 0.0002, batch_size: 8, default_epochs: 50 },
          { key: "yolov8n", display_name: "LemGendary YOLOv8n Multi-Task Model", architecture: "YOLOv8n (CSPDarknet53 + PANet)", task_type: "detection", canonical_format: "directory", parameters_m: 3.2, spatial_ladder: [320, 480, 640], checkpoint_exists: true, preferred_parallel: "single", epochs_completed: 100, best_metric: 0.54, metric_name: "mAP50", learning_rate: 0.01, batch_size: 16, default_epochs: 300 },
          { key: "universal_nsfw_classification", display_name: "Universal Safety Classifier", architecture: "EfficientNet-B0", task_type: "classification", canonical_format: "webdataset", parameters_m: 4.1, spatial_ladder: [224, 256], checkpoint_exists: true, preferred_parallel: "single", epochs_completed: 25, best_metric: 0.982, metric_name: "AUC-ROC", learning_rate: 0.0002, batch_size: 16, default_epochs: 25 },
        ];
        setModels(fallbackList);
        setSelectedModel((prev) => {
          const nextKey = prev || "upn_v2";
          applyModelDefaults(nextKey, fallbackList);
          return nextKey;
        });
        setRefreshFeedback("Training sidecar unreachable: showing fallback architectures.");
      }
    } catch {
      setRefreshFeedback("Error loading models from training sidecar.");
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshFeedback(null), 4000);
    }
  }, [applyModelDefaults]);

  useEffect(() => {
    loadTrainingData();
  }, [loadTrainingData]);

  const handleModelChange = (modelKey: string) => {
    setSelectedModel(modelKey);
    applyModelDefaults(modelKey, models);
  };

  const handleStartTraining = async () => {
    if (!trainingSuiteOnline) {
      setTrainStatus("Training failed: Training Suite Sidecar (Port 8200) is not reachable. Launch lemgendary-training-suite to train.");
      return;
    }
    setIsTraining(true);
    setTrainStatus(null);
    try {
      const res = await triggerQuickTrain({
        model_key: selectedModel,
        preset: "quick-sota",
        epochs,
        batch_size: batchSize,
        learning_rate: learningRate,
        env: "local",
        ladder_stage: selectedLadderStage,
        enable_sawtooth: sawtoothGovernorActive,
      });
      setTrainStatus(`Training run initiated successfully (Job ID: ${res.job_id || "Active"}). Telemetry streaming to console.`);
    } catch {
      setTrainStatus("Training failed: Training Suite Sidecar (Port 8200) is not reachable. Launch lemgendary-training-suite to train.");
    } finally {
      setIsTraining(false);
    }
  };

  const currentModel = models.find((m) => m.key === selectedModel);
  const isForexModel = Boolean(currentModel?.is_forex || currentModel?.category === "forex" || currentModel?.task_type === "forex");

  const ladderStages = useMemo(() => {
    if (currentModel?.spatial_ladder && currentModel.spatial_ladder.length > 0) {
      return currentModel.spatial_ladder;
    }
    return isForexModel ? [1, 5, 15, 60, 240, 1440] : [256, 384, 512, 640];
  }, [currentModel, isForexModel]);

  const formatLadderLabel = (stageValue: number, idx: number, total: number, isForex: boolean) => {
    if (isForex) {
      const tfLabels: Record<number, string> = {
        1: "M1 (1-min) Scalping",
        5: "M5 (5-min) Order Flow",
        15: "M15 (15-min) Trigger Timing",
        60: "H1 (1-hour) Intraday Trend",
        240: "H4 (4-hour) Swing Momentum",
        1440: "D1 (Daily) Macro Regime",
      };
      const label = tfLabels[stageValue] || `${stageValue}m Timeframe`;
      return `Stage ${idx + 1}: ${label} (${idx === 0 ? "Base" : idx === total - 1 ? "Target Confluence" : "Intermediate"})`;
    }
    return `Stage ${idx + 1}: ${stageValue} x ${stageValue} (${idx === 0 ? "Base" : idx === total - 1 ? "Target" : "Progressive"})`;
  };

  useEffect(() => {
    if (ladderStages.length > 0 && !ladderStages.includes(selectedLadderStage)) {
      setSelectedLadderStage(ladderStages[ladderStages.length - 1]);
    }
  }, [ladderStages, selectedLadderStage]);

  return (
    <div className="panel-container">
      <div className="card">
        <div className="card-title">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600 }}>Master Training Suite &amp; Model Orchestration</h3>
            <HelpTooltip content="Master Deep Learning Training Suite. Dispatches multi-GPU DDP training jobs, controls dynamic spatial ladder progression, enforces Sawtooth VRAM protection, and automates ONNX checkpoint export." />
          </div>
          <span className="badge badge-info">Port 8200 Sidecar</span>
        </div>

        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
          Train vision, restoration, and time-series neural architectures from unified_models_v2.yaml with
          real-time Sawtooth Governor memory management and progressive spatial training ladders.
        </p>

        {/* Hero Row: Target Architecture Selection */}
        <div style={{ marginBottom: "18px" }}>
          <div className="form-group">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <label htmlFor="model-select" style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                  Target Architecture:
                </label>
                <HelpTooltip content="Select the neural architecture to train or evaluate. Loads authoritative configuration from unified_models_v2.yaml." />
              </div>
              {currentModel && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span className="badge badge-info" style={{ fontSize: "11px" }}>{currentModel.task_type}</span>
                  {currentModel.parameters_m && (
                    <span className="badge" style={{ fontSize: "11px", backgroundColor: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                      {currentModel.parameters_m} M params
                    </span>
                  )}
                  {currentModel.canonical_format && (
                    <span className="badge" style={{ fontSize: "11px", backgroundColor: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                      {currentModel.canonical_format.toUpperCase()}
                    </span>
                  )}
                  {currentModel.preferred_parallel && (
                    <span className="badge" style={{ fontSize: "11px", backgroundColor: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                      {currentModel.preferred_parallel.toUpperCase()}
                    </span>
                  )}
                </div>
              )}
            </div>
            <select
              id="model-select"
              className="editor-select"
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={isTraining}
              style={{ width: "100%", padding: "8px 12px", fontSize: "13px" }}
            >
              {models.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.display_name} ({m.architecture})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Hyperparameters Grid: 4 clean columns */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "18px" }}>
          <div className="form-group">
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <label htmlFor="epochs-input" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Training Epochs:
              </label>
              <HelpTooltip content="Total training passes over the dataset. Automatically populated with model default or preset." />
            </div>
            <input
              id="epochs-input"
              type="number"
              className="editor-input"
              value={epochs}
              onChange={(e) => setEpochs(Number(e.target.value))}
              disabled={isTraining}
              min={1}
              max={500}
            />
          </div>

          <div className="form-group">
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <label htmlFor="batch-size-input" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Minibatch Size:
              </label>
              <HelpTooltip content="Number of samples per training forward pass per GPU worker. Automatically scaled down by the Sawtooth Governor if VRAM pressure exceeds 92%." />
            </div>
            <input
              id="batch-size-input"
              type="number"
              className="editor-input"
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              disabled={isTraining}
              min={1}
              max={256}
            />
          </div>

          <div className="form-group">
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <label htmlFor="learning-rate-input" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Initial Learning Rate:
              </label>
              <HelpTooltip content="Base learning rate for AdamW/Lion optimizer with cosine annealing warm restarts." />
            </div>
            <input
              id="learning-rate-input"
              type="number"
              step="0.00005"
              className="editor-input"
              value={learningRate}
              onChange={(e) => setLearningRate(Number(e.target.value))}
              disabled={isTraining}
            />
          </div>

          <div className="form-group">
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <label htmlFor="spatial-ladder-select" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {isForexModel ? "Timeframe Confluence Stage:" : "Spatial Ladder Stage:"}
              </label>
              <HelpTooltip content={isForexModel ? "Select multi-timeframe confluence horizon for causal TCN and cross-attention fusion." : "Select spatial training resolution stage. Progressive resolution scaling accelerates initial convergence and sharpens final high-frequency detail."} />
            </div>
            <select
              id="spatial-ladder-select"
              className="editor-select"
              value={selectedLadderStage}
              onChange={(e) => setSelectedLadderStage(Number(e.target.value))}
              disabled={isTraining}
            >
              {ladderStages.map((res, idx) => (
                <option key={res} value={res}>
                  {formatLadderLabel(res, idx, ladderStages.length, isForexModel)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Governor Sentinel Card */}
        <div style={{ marginBottom: "20px" }}>
          <div className="governor-toggle-card">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                id="sawtooth-check"
                type="checkbox"
                checked={sawtoothGovernorActive}
                onChange={(e) => setSawtoothGovernorActive(e.target.checked)}
                disabled={isTraining}
                style={{ cursor: "pointer", width: "16px", height: "16px" }}
              />
              <label htmlFor="sawtooth-check" style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", cursor: "pointer" }}>
                Enable Sawtooth VRAM Governor
              </label>
              <HelpTooltip content="Monitors GPU VRAM allocation every 50 iterations. If VRAM exceeds 92%, dynamically halves batch size and adds gradient accumulation to prevent CUDA Out-Of-Memory exceptions." />
            </div>
            <span
              className={`badge ${sawtoothGovernorActive ? "badge-success" : "badge-secondary"}`}
              style={{ fontSize: "11px", fontWeight: 600 }}
            >
              {sawtoothGovernorActive ? "ACTIVE (92% VRAM Sentinel)" : "DISABLED"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleStartTraining}
            disabled={isTraining || !trainingSuiteOnline}
            aria-label={!trainingSuiteOnline ? "Training unavailable: Training Suite Sidecar offline" : "Initiate neural model training pass"}
            aria-disabled={!trainingSuiteOnline}
          >
            {isTraining ? "Dispatching Job..." : "Start Training"}
          </button>
          <HelpTooltip content="Launch the training execution loop. Spawns background worker process, records checkpoint artifacts, and streams telemetry to the local console." />

          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadTrainingData}
            disabled={isTraining || isRefreshing}
            aria-label="Refresh models and metrics from training sidecar"
          >
            {isRefreshing ? "Refreshing Models..." : "Refresh Models"}
          </button>
          <HelpTooltip content="Poll port 8200 sidecar to update model weights status, best validation metrics, and active training telemetry from unified_models_v2.yaml." />
        </div>

        {refreshFeedback && (
          <div className="validation-banner banner-info" style={{ marginTop: "12px" }} role="status">
            <span>{refreshFeedback}</span>
          </div>
        )}

        {!trainingSuiteOnline && (
          <div className="validation-banner banner-error" style={{ marginTop: "12px" }} role="alert">
            <span>Training Suite Sidecar (Port 8200) is offline. Launch lemgendary-training-suite to enable training dispatch.</span>
          </div>
        )}

        {trainStatus && (
          <div className="validation-banner banner-success" style={{ marginTop: "16px" }} role="status">
            <span>{trainStatus}</span>
          </div>
        )}
      </div>

      <div style={{ marginTop: "24px" }}>
        <h4 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "16px" }}>
          Registered Architectures &amp; Checkpoint Telemetry
        </h4>
        <div className="card-grid">
          {models.map((m) => (
            <div key={m.key} className="card">
              <div className="card-title">
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <h5 style={{ fontSize: "14px", fontWeight: 600 }}>{m.display_name}</h5>
                  <HelpTooltip content={`Architecture specs for ${m.key}. Parallel execution mode: ${m.preferred_parallel?.toUpperCase() || "SINGLE"}.`} />
                </div>
                {m.training_status === "fully_trained" ? (
                  <span className="badge badge-success">FULLY TRAINED</span>
                ) : m.training_status === "partially_trained" || (m.epochs_completed ?? 0) > 0 ? (
                  <span className="badge badge-info">PARTIALLY TRAINED</span>
                ) : m.checkpoint_exists ? (
                  <span className="badge badge-success">WEIGHTS READY</span>
                ) : (
                  <span className="badge badge-warning">INITIALIZING</span>
                )}
              </div>

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

              <div className="metric-row">
                <span className="metric-label">Best {m.metric_name || "Metric"}</span>
                <span className="metric-value" style={{ color: "var(--accent-emerald)" }}>
                  {m.best_metric !== undefined ? m.best_metric : "N/A"}
                </span>
              </div>

              {m.sota_targets_total !== undefined && m.sota_targets_total > 0 && (
                <div className="metric-row">
                  <span className="metric-label">SOTA Targets</span>
                  <span
                    className="metric-value"
                    style={{
                      color: m.sota_reached ? "var(--accent-emerald)" : (m.sota_targets_met ?? 0) > 0 ? "#38bdf8" : "var(--text-muted)",
                      fontWeight: 600,
                    }}
                  >
                    {m.sota_targets_met ?? 0} / {m.sota_targets_total} Met {m.sota_reached ? "(All Passed)" : ""}
                  </span>
                </div>
              )}

              {m.sota_target !== undefined && (
                <div className="metric-row">
                  <span className="metric-label">Primary Target</span>
                  <span
                    className="metric-value"
                    style={{
                      color: "var(--text-muted)",
                      fontWeight: 500,
                    }}
                  >
                    {m.sota_target}
                  </span>
                </div>
              )}

              <div className="metric-row">
                <span className="metric-label">{m.is_forex || m.ladder_type === "timeframe" ? "Confluence Ladder" : "Resolution Ladder"}</span>
                <span
                  className="metric-value"
                  style={{
                    color: m.ladder_passed ? "var(--accent-emerald)" : undefined,
                  }}
                >
                  {m.ladder_passed
                    ? (m.is_forex || m.ladder_type === "timeframe" ? "Full Confluence (D1)" : `Full (${m.target_res ?? m.max_res_completed ?? 512}px)`)
                    : (m.is_forex || m.ladder_type === "timeframe" ? "Partial Confluence" : `${m.max_res_completed ?? 0}px / ${m.target_res ?? 512}px`)}
                </span>
              </div>

              <div className="metric-row">
                <span className="metric-label">Data Fraction</span>
                <span
                  className="metric-value"
                  style={{
                    color: m.data_fraction_passed ? "var(--accent-emerald)" : undefined,
                  }}
                >
                  {m.data_fraction_completed ? `${Math.round(m.data_fraction_completed * 100)}%` : "0%"} {m.data_fraction_passed ? "(100% Passed)" : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrainingPanel;
