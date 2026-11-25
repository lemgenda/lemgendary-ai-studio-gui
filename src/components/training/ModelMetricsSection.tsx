import React from "react";
import { HoverPinPopover } from "../common/HoverPinPopover";
import { ModelItem } from "../../api/types";

/** Shown for training state the GUI does not know (offline placeholders); never a guessed value. */
const UNKNOWN_LABEL = "Unknown";

interface ModelMetricsSectionProps {
  model: ModelItem;
  /** Offline placeholder: training state is unknown. */
  statusUnknown: boolean;
  isTargetPinned: boolean;
  onToggleTargetPin: () => void;
}

/** Metric rows of a model card: architecture, epochs, SOTA targets, ladder and data fraction. */
export const ModelMetricsSection: React.FC<ModelMetricsSectionProps> = ({
  model: m,
  statusUnknown,
  isTargetPinned,
  onToggleTargetPin,
}) => {
  const isContextLlm = m.is_llm || m.ladder_type === "context_tokens";
  const dataPassed =
    isContextLlm ||
    (m.is_forex
      ? (m.active_fold ?? m.active_res ?? 1) >= (m.total_folds ?? 6)
      : Boolean(m.data_fraction_passed && (m.data_fraction_completed ?? 0) >= 0.99));

  return (
    <div className="card-specs-list">
      <div className="metric-row">
        <span className="metric-label">Neural Architecture</span>
        <span className="metric-value">{m.architecture}</span>
      </div>

      <div className="metric-row">
        <span className="metric-label">Parameters</span>
        <span className="metric-value">{m.parameters_m != null ? `${m.parameters_m}\u00A0M` : "N/A"}</span>
      </div>

      <div className="metric-row">
        <span className="metric-label">Task Category</span>
        <span className="metric-value">{m.task_type}</span>
      </div>

      {/* Dedicated LLM Matrix for AIHelperLemGend */}
      {(m.category === "llm" || m.key === "ai_helper_lemgend") && (
        <div className="llm-matrix-card">
          <div className="llm-matrix-title">
            QLoRA Instruction Tuning Matrix
          </div>
          <div className="llm-matrix-grid">
            <div>
              Context: <strong className="llm-matrix-val">2048 tokens</strong>
            </div>
            <div>
              Adapter: <strong className="llm-matrix-val">LoRA (r=16, &alpha;=32)</strong>
            </div>
            <div>
              Loss: <strong className="llm-matrix-val">Cross-Entropy</strong>
            </div>
            <div>
              Base: <strong className="llm-matrix-val">Qwen2.5-Coder-1.5B</strong>
            </div>
          </div>
        </div>
      )}

      <div className="metric-row">
        <span className="metric-label">Completed Epochs</span>
        <span className="metric-value">{statusUnknown ? UNKNOWN_LABEL : m.epochs_completed ?? 0}</span>
      </div>

      {/* 4. Target Metrics Card (SOTA) - HoverPinPopover */}
      <HoverPinPopover
        title="Target Metrics (SOTA)"
        isPinned={isTargetPinned}
        onTogglePin={onToggleTargetPin}
        valueBadge={
          <span
            className={`metric-value metric-value-highlight ${
              m.sota_reached
                ? "metric-value-emerald"
                : (m.sota_targets_met ?? 0) > 0
                ? "metric-value-sky"
                : "metric-value-muted"
            }`}
          >
            {statusUnknown
              ? UNKNOWN_LABEL
              : m.sota_targets_total
              ? `${m.sota_targets_met ?? 0} / ${m.sota_targets_total} Met`
              : m.sota_reached
              ? "Target Reached"
              : "Pending"}
          </span>
        }
        ariaLabel={`Target metrics details for ${m.display_name}. Click to pin open.`}
      >
        {m.sota_details && m.sota_details.length > 0 && (
          <div className="stack-xs">
            {m.sota_details.map((s) => (
              <div
                key={s.key}
                className="sota-detail-row"
              >
                <span className="sota-detail-label">{s.label}:</span>
                <div className="row-gap-md">
                  <span className="sota-detail-goal">Goal: {s.target ?? "—"}</span>
                  <span
                    className={`sota-detail-achieved ${
                      s.passed
                        ? "sota-achieved-pass"
                        : s.achieved !== null
                        ? "sota-achieved-fail"
                        : ""
                    }`}
                  >
                    {s.achieved !== null ? s.achieved : "—"}
                  </span>
                  <span
                    className={`badge badge-xs-wide ${s.passed ? "badge-success" : "badge-secondary"}`}
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
          {isContextLlm
            ? "Context Window"
            : m.is_forex || m.ladder_type === "timeframe"
            ? "Confluence Ladder"
            : "Resolution Ladder"}
        </span>
        <span
          className={`metric-value metric-value-bold ${m.ladder_passed ? "metric-value-emerald" : ""}`}
        >
          {statusUnknown
            ? UNKNOWN_LABEL
            : isContextLlm
            ? m.target_res != null
              ? `${m.target_res} tokens (Full)`
              : UNKNOWN_LABEL
            : m.ladder_passed
            ? m.is_forex || m.ladder_type === "timeframe"
              ? "Full Confluence (D1)"
              : m.target_res != null
              ? `Full (${m.target_res}px)`
              : "Full"
            : m.is_forex || m.ladder_type === "timeframe"
            ? "Partial Confluence"
            : m.target_res != null
            ? `${m.active_res ?? "?"}px / ${m.target_res}px`
            : UNKNOWN_LABEL}
        </span>
      </div>

      {/* 6. Data Fraction, Walk-Forward Fold (Forex), or Instruction Corpus (LLM) */}
      <div className="metric-row">
        <span className="metric-label">
          {isContextLlm
            ? "Training Dataset"
            : m.is_forex
            ? "Walk-Forward Fold"
            : "Data Fraction"}
        </span>
        <span
          className={`metric-value metric-value-bold ${dataPassed ? "metric-value-emerald" : ""}`}
        >
          {isContextLlm
            ? "LemGendizedAIHelperLemGend"
            : statusUnknown
            ? UNKNOWN_LABEL
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
  );
};
