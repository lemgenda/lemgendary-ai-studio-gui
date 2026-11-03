import React from "react";
import { HelpTooltip } from "../HelpTooltip";
import { ModelItem } from "../../api/types";
import { TrainingStatusBadge } from "./TrainingStatusBadge";
import { VariationBadges } from "./VariationBadges";
import { ModelMetricsSection } from "./ModelMetricsSection";
import { BatchSizeSelector } from "./BatchSizeSelector";
import { ModelCardActionHandlers, ModelCardActions } from "./ModelCardActions";

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

  React.useEffect(() => {
    if (m.batch_size) {
      setSelectedBatchSize(m.batch_size);
    }
  }, [m.batch_size]);

  // The sidecar could not compute this model's stats: metrics are unknown, never fabricated.
  const statusUnknown = m.training_status === "unknown";

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
        value={selectedBatchSize}
        onChange={setSelectedBatchSize}
        disabled={isBusy || isCurrentlyTrainingThis}
        modelName={m.display_name}
      />

      {/* 4. Action Buttons Toolbar on each card */}
      <ModelCardActions
        model={m}
        isCurrentlyTrainingThis={isCurrentlyTrainingThis}
        isBusy={isBusy}
        actionBusyKey={actionBusyKey}
        generatingNotebookModel={generatingNotebookModel}
        trainingSuiteOnline={trainingSuiteOnline}
        selectedBatchSize={selectedBatchSize}
        {...actionHandlers}
      />
    </div>
  );
};
