import React from "react";
import { HelpTooltip } from "../HelpTooltip";
import { HoverPinPopover } from "../common/HoverPinPopover";
import { ModelItem } from "../../api/types";

export interface ModelManifoldCardProps {
  model: ModelItem;
  isCurrentlyTrainingThis: boolean;
  isBusy: boolean;
  actionBusyKey: string | null;
  isTargetPinned: boolean;
  onToggleTargetPin: () => void;
  generatingNotebookModel: string | null;
  onStartLocalTrain: (model: ModelItem, batchSize?: number) => void;
  onStopLocalTrain: () => void;
  onOpenCloudModal: (model: ModelItem) => void;
  onPushArtifacts: (modelKey: string) => void;
  onPullArtifacts: (modelKey: string) => void;
  onGenerateTrainingNotebook: (modelKey: string) => void;
  onGenerateUsageNotebook: (modelKey: string) => void;
  onEvaluateModel: (modelKey: string) => void;
  onExportModel: (modelKey: string) => void;
  onGenerateDocs: (modelKey: string) => void;
  onStageVariations: (modelKey: string) => void;
  trainingSuiteOnline: boolean;
}

export const ModelManifoldCard: React.FC<ModelManifoldCardProps> = ({
  model: m,
  isCurrentlyTrainingThis,
  isBusy,
  actionBusyKey,
  isTargetPinned,
  onToggleTargetPin,
  generatingNotebookModel,
  onStartLocalTrain,
  onStopLocalTrain,
  onOpenCloudModal,
  onPushArtifacts,
  onPullArtifacts,
  onGenerateTrainingNotebook,
  onGenerateUsageNotebook,
  onEvaluateModel,
  onExportModel,
  onGenerateDocs,
  onStageVariations,
  trainingSuiteOnline,
}) => {
  const [selectedBatchSize, setSelectedBatchSize] = React.useState<number>(m.batch_size ?? 256);

  React.useEffect(() => {
    if (m.batch_size) {
      setSelectedBatchSize(m.batch_size);
    }
  }, [m.batch_size]);

  return (
    <div
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
        <HelpTooltip
          content={`Authoritative model key: ${m.key}. Parallel execution mode: ${m.preferred_parallel?.toUpperCase() || "SINGLE"}.`}
        />
      </div>

      {/* 2. Training Progress / Status: Full-width directly below Model Name */}
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          background: "rgba(255,255,255,0.03)",
          padding: "6px 10px",
          borderRadius: "6px",
          border: "1px solid var(--border-color)",
        }}
      >
        <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
          Training Progress:
        </span>
        <div>
          {m.training_status === "fully_trained" ? (
            <span className="badge badge-success" style={{ fontWeight: 700 }}>
              FULLY TRAINED
            </span>
          ) : m.training_status === "partially_trained" || (m.epochs_completed ?? 0) > 0 ? (
            <span className="badge badge-info" style={{ fontWeight: 700 }}>
              PARTIALLY TRAINED
            </span>
          ) : m.checkpoint_exists ? (
            <span className="badge badge-success" style={{ fontWeight: 700 }}>
              WEIGHTS READY
            </span>
          ) : (
            <span className="badge badge-warning" style={{ fontWeight: 700 }}>
              INITIALIZING
            </span>
          )}
        </div>
      </div>

      {/* 2b. Isolated Kaggle Variations Status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          flexWrap: "wrap",
          padding: "4px 8px",
          background: "rgba(0,0,0,0.15)",
          borderRadius: "6px",
          border: "1px solid var(--border-color)",
        }}
      >
        <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600 }}>VARIATIONS:</span>
        <span
          className={`badge ${m.checkpoint_exists ? "badge-success" : "badge-secondary"}`}
          style={{ fontSize: "9px", padding: "2px 6px" }}
          title="PyTorch (.pt) standalone binary in dist/kaggle/pytorch/"
        >
          PyTorch (.pt)
        </span>
        <span
          className={`badge ${m.checkpoint_exists ? "badge-success" : "badge-secondary"}`}
          style={{ fontSize: "9px", padding: "2px 6px" }}
          title="ONNX FP32 + External Tensor Data in dist/kaggle/onnx_fp32/"
        >
          ONNX FP32
        </span>
        <span
          className={`badge ${m.checkpoint_exists ? "badge-success" : "badge-secondary"}`}
          style={{ fontSize: "9px", padding: "2px 6px" }}
          title="ONNX FP16 Embedded in dist/kaggle/onnx_fp16/"
        >
          ONNX FP16
        </span>
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

        {/* Dedicated LLM Matrix for AIHelperLemGend */}
        {(m.category === "llm" || m.key === "ai_helper_lemgend") && (
          <div
            style={{
              background: "rgba(139, 92, 246, 0.08)",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              borderRadius: "6px",
              padding: "8px 10px",
              margin: "4px 0",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#a78bfa", marginBottom: "4px" }}>
              QLoRA Instruction Tuning Matrix
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "4px",
                fontSize: "11px",
                color: "var(--text-secondary)",
              }}
            >
              <div>
                Context: <strong style={{ color: "var(--text-primary)" }}>2048 tokens</strong>
              </div>
              <div>
                Adapter: <strong style={{ color: "var(--text-primary)" }}>LoRA (r=16, &alpha;=32)</strong>
              </div>
              <div>
                Loss: <strong style={{ color: "var(--text-primary)" }}>Cross-Entropy</strong>
              </div>
              <div>
                Base: <strong style={{ color: "var(--text-primary)" }}>Qwen2.5-Coder-1.5B</strong>
              </div>
            </div>
          </div>
        )}

        <div className="metric-row">
          <span className="metric-label">Completed Epochs</span>
          <span className="metric-value">{m.epochs_completed ?? 0}</span>
        </div>

        {/* 4. Target Metrics Card (SOTA) - HoverPinPopover */}
        <HoverPinPopover
          title="Target Metrics (SOTA)"
          isPinned={isTargetPinned}
          onTogglePin={onToggleTargetPin}
          valueBadge={
            <span
              className="metric-value"
              style={{
                color: m.sota_reached
                  ? "var(--accent-emerald)"
                  : (m.sota_targets_met ?? 0) > 0
                  ? "#38bdf8"
                  : "var(--text-muted)",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              {m.sota_targets_total
                ? `${m.sota_targets_met ?? 0} / ${m.sota_targets_total} Met`
                : m.sota_reached
                ? "Target Reached"
                : "Pending"}
            </span>
          }
          ariaLabel={`Target metrics details for ${m.display_name}. Click to pin open.`}
        >
          {m.sota_details && m.sota_details.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {m.sota_details.map((s) => (
                <div
                  key={s.key}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>{s.label}:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Goal: {s.target}</span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: s.passed
                          ? "var(--accent-emerald)"
                          : s.achieved !== null
                          ? "var(--accent-rose)"
                          : "var(--text-muted)",
                      }}
                    >
                      {s.achieved !== null ? s.achieved : "—"}
                    </span>
                    <span
                      className={`badge ${s.passed ? "badge-success" : "badge-secondary"}`}
                      style={{ fontSize: "9px", padding: "1px 5px" }}
                    >
                      {s.passed ? "PASS" : "PENDING"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </HoverPinPopover>

        {/* 5. Resolution / Confluence / Context Ladder */}
        <div className="metric-row">
          <span className="metric-label">
            {m.is_llm || m.ladder_type === "context_tokens"
              ? "Context Window"
              : m.is_forex || m.ladder_type === "timeframe"
              ? "Confluence Ladder"
              : "Resolution Ladder"}
          </span>
          <span
            className="metric-value"
            style={{
              color: m.ladder_passed ? "var(--accent-emerald)" : undefined,
              fontWeight: 600,
            }}
          >
            {m.is_llm || m.ladder_type === "context_tokens"
              ? `${m.target_res ?? 2048} tokens (Full)`
              : m.ladder_passed
              ? m.is_forex || m.ladder_type === "timeframe"
                ? "Full Confluence (D1)"
                : `Full (${m.target_res ?? 512}px)`
              : m.is_forex || m.ladder_type === "timeframe"
              ? "Partial Confluence"
              : `${m.active_res ?? (m.spatial_ladder && m.spatial_ladder.length > 0 ? m.spatial_ladder[0] : 256)}px / ${m.target_res ?? 512}px`}
          </span>
        </div>

        {/* 6. Data Fraction, Walk-Forward Fold (Forex), or Instruction Corpus (LLM) */}
        <div className="metric-row">
          <span className="metric-label">
            {m.is_llm || m.ladder_type === "context_tokens"
              ? "Training Dataset"
              : m.is_forex
              ? "Walk-Forward Fold"
              : "Data Fraction"}
          </span>
          <span
            className="metric-value"
            style={{
              color:
                m.is_llm || m.ladder_type === "context_tokens"
                  ? "var(--accent-emerald)"
                  : m.is_forex
                  ? (m.active_fold ?? m.active_res ?? 1) >= (m.total_folds ?? 6)
                    ? "var(--accent-emerald)"
                    : undefined
                  : m.data_fraction_passed && (m.data_fraction_completed ?? 0) >= 0.99
                  ? "var(--accent-emerald)"
                  : undefined,
              fontWeight: 600,
            }}
          >
            {m.is_llm || m.ladder_type === "context_tokens"
              ? "LemGendizedAIHelperLemGend"
              : m.is_forex
              ? (() => {
                  const fold = m.active_fold ?? m.active_res ?? 1;
                  const total = m.total_folds ?? 6;
                  const yearsLabel =
                    m.fold_years_label ??
                    (fold >= 1 && fold <= 6
                      ? `${2019}-${2019 + fold} -> ${2019 + fold + 1}`
                      : null);
                  return `Fold ${fold} / ${total}${yearsLabel ? ` (${yearsLabel})` : ""}`;
                })()
              : m.data_fraction_passed && (m.data_fraction_completed ?? 0) >= 0.99
              ? "100% (Passed)"
              : `${Math.round((m.data_fraction_completed ?? 0) * 100)}%`}
          </span>
        </div>
      </div>

      {/* Batch Size Selector */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          background: "rgba(255, 255, 255, 0.02)",
          padding: "5px 10px",
          borderRadius: "6px",
          border: "1px solid var(--border-color)",
          marginTop: "auto",
        }}
      >
        <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 600 }}>
          Batch Size:
        </span>
        <select
          value={selectedBatchSize}
          onChange={(e) => setSelectedBatchSize(Number(e.target.value))}
          disabled={isBusy || isCurrentlyTrainingThis}
          aria-label={`Select local batch size for ${m.display_name}`}
          style={{
            padding: "2px 8px",
            fontSize: "11px",
            fontWeight: 700,
            borderRadius: "4px",
            background: "rgba(15, 23, 42, 0.8)",
            border: "1px solid var(--border-color)",
            color: "var(--text-primary)",
            cursor: isBusy || isCurrentlyTrainingThis ? "not-allowed" : "pointer",
          }}
        >
          <option value={8}>8</option>
          <option value={16}>16</option>
          <option value={32}>32</option>
          <option value={64}>64</option>
          <option value={128}>128</option>
          <option value={256}>256</option>
          <option value={512}>512</option>
          <option value={1024}>1024</option>
        </select>
      </div>

      {/* 4. Action Buttons Toolbar on each card */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          paddingTop: "6px",
          borderTop: "1px solid var(--border-color)",
        }}
      >
        {/* Local Training */}
        {isCurrentlyTrainingThis ? (
          <button
            id={`train-btn-stop-${m.key}`}
            type="button"
            className="btn btn-danger"
            onClick={onStopLocalTrain}
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
            id={`train-btn-start-${m.key}`}
            type="button"
            className="btn btn-primary"
            onClick={() => onStartLocalTrain(m, selectedBatchSize)}
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
          id={`train-btn-cloud-${m.key}`}
          type="button"
          className="btn btn-cloud"
          onClick={() => onOpenCloudModal(m)}
          disabled={isBusy}
          style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
          title="Opens Cloud Training dialog to pre-validate URLs, attached datasets, and launch on Kaggle GPU"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          </svg>
          <span>Cloud Training</span>
        </button>

        {/* Push Model */}
        <button
          id={`train-btn-pub-model-${m.key}`}
          type="button"
          className="btn btn-vault-push"
          onClick={() => onPushArtifacts(m.key)}
          disabled={isBusy}
          style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
          title="Pushes all 4 model variations (PyTorch Checkpoints, PyTorch FP32, ONNX FP16, ONNX FP32) to Kaggle Models Hub"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Push Model</span>
        </button>

        {/* Pull Model */}
        <button
          id={`train-btn-pull-model-${m.key}`}
          type="button"
          className="btn btn-vault-pull"
          onClick={() => onPullArtifacts(m.key)}
          disabled={isBusy}
          style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
          title="Downloads the latest model variation from Kaggle Models Hub into local LemGendaryModels"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Pull Model</span>
        </button>

        {/* Training Notebook */}
        <button
          id={`train-btn-gen-nb-${m.key}`}
          type="button"
          className="btn btn-notebook-train"
          onClick={() => onGenerateTrainingNotebook(m.key)}
          disabled={isBusy || generatingNotebookModel === `${m.key}_training`}
          style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
          title="Regenerates training notebooks in Model folder (both Colab and Kaggle)"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span>
            {generatingNotebookModel === `${m.key}_training` ? "Generating..." : "Training Notebook"}
          </span>
        </button>

        {/* Usage Notebook */}
        <button
          id={`train-btn-usage-nb-${m.key}`}
          type="button"
          className="btn btn-notebook-usage"
          onClick={() => onGenerateUsageNotebook(m.key)}
          disabled={isBusy || generatingNotebookModel === `${m.key}_usage`}
          style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
          title="Regenerates standalone usage guide notebooks in Model folder (both Colab and Kaggle)"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span>
            {generatingNotebookModel === `${m.key}_usage` ? "Generating..." : "Usage Notebook"}
          </span>
        </button>

        {/* Evaluate Model */}
        <button
          id={`train-btn-eval-${m.key}`}
          type="button"
          className="btn btn-secondary"
          onClick={() => onEvaluateModel(m.key)}
          disabled={isBusy || !trainingSuiteOnline}
          style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
          title="Runs evaluation on validation split and streams metrics"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{actionBusyKey === `eval_${m.key}` ? "Evaluating..." : "Evaluate Model"}</span>
        </button>

        {/* Export Model */}
        <button
          id={`train-btn-export-${m.key}`}
          type="button"
          className="btn btn-secondary"
          onClick={() => onExportModel(m.key)}
          disabled={isBusy || !trainingSuiteOnline}
          style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
          title="Compiles model checkpoint into ONNX FP32/FP16 and TorchScript deployment binaries"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <polyline points="16 16 12 12 8 16" />
            <line x1="12" y1="12" x2="12" y2="21" />
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
          </svg>
          <span>{actionBusyKey === `export_${m.key}` ? "Exporting..." : "Export Binaries"}</span>
        </button>

        {/* Regenerate Docs & Metadata */}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onGenerateDocs(m.key)}
          disabled={isBusy}
          style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
          title="Regenerates Markdown Model Card (README.md) and Kaggle model-metadata.json from SSOT"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span>{actionBusyKey === `docs_${m.key}` ? "Regenerating..." : "Docs & Meta"}</span>
        </button>

        {/* Stage Variations */}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onStageVariations(m.key)}
          disabled={isBusy}
          style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
          title="Stages exported model binaries into isolated Kaggle variation subdirectories (dist/kaggle/)"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <span>{actionBusyKey === `stage_${m.key}` ? "Staging..." : "Stage Variations"}</span>
        </button>


      </div>
    </div>
  );
};
