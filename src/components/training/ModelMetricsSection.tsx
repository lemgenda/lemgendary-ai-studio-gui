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
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
    <div className="metric-row">
      <span className="metric-label">Neural Architecture</span>
      <span className="metric-value">{m.architecture}</span>
    </div>

    <div className="metric-row">
      <span className="metric-label">Parameters</span>
      <span className="metric-value">{m.parameters_m != null ? `${m.parameters_m} M` : "N/A"}</span>
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
      <span className="metric-value">{statusUnknown ? UNKNOWN_LABEL : m.epochs_completed ?? 0}</span>
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
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {m.sota_details.map((s) => (
            <div
              key={s.key}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" }}
            >
              <span style={{ color: "var(--text-secondary)" }}>{s.label}:</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--text-muted)" }}>Goal: {s.target ?? "—"}</span>
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
        {statusUnknown
          ? UNKNOWN_LABEL
          : m.is_llm || m.ladder_type === "context_tokens"
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
