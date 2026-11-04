import React from "react";
import { ModelItem, TrainingStatus } from "../../api/types";

interface TrainingStatusBadgeProps {
  model: ModelItem;
  /** The sidecar sent `training_status: "unknown"` (stats could not be computed). */
  statusUnknown: boolean;
}

const BADGES: Record<Exclude<TrainingStatus, "unknown">, { className: string; label: string }> = {
  fully_trained: { className: "badge badge-success", label: "FULLY TRAINED" },
  partially_trained: { className: "badge badge-info", label: "PARTIALLY TRAINED" },
  weights_ready: { className: "badge badge-success", label: "WEIGHTS READY" },
  initializing: { className: "badge badge-warning", label: "INITIALIZING" },
};

/** Training progress badge of a model card: shows the Training Suite verdict as sent, never derived. */
export const TrainingStatusBadge: React.FC<TrainingStatusBadgeProps> = ({ model: m, statusUnknown }) => {
  if (statusUnknown || m.training_status === "unknown") {
    return (
      <div>
        <span
          className="badge badge-secondary"
          style={{ fontWeight: 700 }}
          title={m.stats_error ? `Training Suite could not compute stats: ${m.stats_error}` : "Training Suite reported the training status as unknown."}
        >
          UNKNOWN
        </span>
      </div>
    );
  }
  const badge = BADGES[m.training_status];
  return (
    <div>
      <span className={badge.className} style={{ fontWeight: 700 }}>
        {badge.label}
      </span>
    </div>
  );
};
