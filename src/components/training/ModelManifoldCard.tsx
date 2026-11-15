import React from "react";
import { HelpTooltip } from "../HelpTooltip";
import { ModelItem } from "../../api/types";
import { TrainingStatusBadge } from "./TrainingStatusBadge";
import { VariationBadges } from "./VariationBadges";
import { ModelMetricsSection } from "./ModelMetricsSection";
import { BatchSizeSelector } from "./BatchSizeSelector";
import { ModelCardActionHandlers, ModelCardActions } from "./ModelCardActions";
import { OverrideFrozenToggle } from "./OverrideFrozenToggle";

export interface ModelManifoldCardProps extends ModelCardActionHandlers {
  model: ModelItem;
  isCurrentlyTrainingThis: boolean;
  isBusy: boolean;
  actionBusyKey: string | null;
  isTargetPinned: boolean;
  onToggleTargetPin: () => void;
  generatingNotebookModel: string | null;
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
  trainingSuiteOnline,
  ...actionHandlers
}) => {
  const [selectedBatchSize, setSelectedBatchSize] = React.useState<number>(m.batch_size ?? 256);
  // Off by default: a resume with changed frozen settings is refused unless the user opts in.
  const [overrideFrozen, setOverrideFrozen] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (m.batch_size) {
      setSelectedBatchSize(m.batch_size);
    }
  }, [m.batch_size]);

  // The sidecar could not compute this model's stats: metrics are unknown, never fabricated.
  const statusUnknown = m.training_status === "unknown";
  const [isExpanded, setIsExpanded] = React.useState<boolean>(false);

  return (
    <div
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: isExpanded ? "10px" : "0px",
        padding: isExpanded ? "16px" : "12px 16px",
        border: isCurrentlyTrainingThis ? "1px solid var(--accent-emerald)" : undefined,
        background: isCurrentlyTrainingThis ? "rgba(16, 185, 129, 0.03)" : undefined,
      }}
    >
      {/* 1. Model Name: Full-width collapsible header at the very top */}
      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flex: 1,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
            color: "var(--text-primary)",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              flexShrink: 0,
              color: "var(--text-muted)",
              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <h4 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-primary)", lineHeight: 1.3 }}>
            {m.display_name}
          </h4>
        </button>
        <HelpTooltip
          content={`Authoritative model key: ${m.key}. Parallel execution mode: ${m.preferred_parallel?.toUpperCase() || "SINGLE"}.`}
        />
      </div>

      {isExpanded && (
        <>

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
        <TrainingStatusBadge model={m} statusUnknown={statusUnknown} />
      </div>

      {/* 2b. Isolated Kaggle Variations Status */}
      <VariationBadges model={m} />

      {/* 3. Metric Specs Rows */}
      <ModelMetricsSection
        model={m}
        statusUnknown={statusUnknown}
        isTargetPinned={isTargetPinned}
        onToggleTargetPin={onToggleTargetPin}
      />

      <BatchSizeSelector
        modelKey={m.key}
        value={selectedBatchSize}
        onChange={setSelectedBatchSize}
        disabled={isBusy || isCurrentlyTrainingThis}
        modelName={m.display_name}
      />

      {/* The QLoRA route of assistant LLMs has no frozen settings guard. */}
      {!m.is_llm && (
        <OverrideFrozenToggle
          id={`train-input-override-frozen-${m.key}`}
          checked={overrideFrozen}
          onChange={setOverrideFrozen}
          disabled={isBusy || isCurrentlyTrainingThis}
          context={m.display_name}
          style={{ padding: "0 10px" }}
        />
      )}

      {/* 4. Action Buttons Toolbar on each card */}
      <ModelCardActions
        model={m}
        isCurrentlyTrainingThis={isCurrentlyTrainingThis}
        isBusy={isBusy}
        actionBusyKey={actionBusyKey}
        generatingNotebookModel={generatingNotebookModel}
        trainingSuiteOnline={trainingSuiteOnline}
        localTrainSettings={{ batchSize: selectedBatchSize, overrideFrozen: !m.is_llm && overrideFrozen }}
        {...actionHandlers}
      />
        </>
      )}
    </div>
  );
};
