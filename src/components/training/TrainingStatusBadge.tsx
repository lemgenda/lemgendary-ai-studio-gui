import React from "react";
import { ModelItem } from "../../api/types";

interface TrainingStatusBadgeProps {
  model: ModelItem;
  /** Offline placeholder: the real training status is unknown. */
  statusUnknown: boolean;
}

/** Training progress badge of a model card. */
export const TrainingStatusBadge: React.FC<TrainingStatusBadgeProps> = ({ model: m, statusUnknown }) => (
  <div>
    {statusUnknown ? (
      <span
        className="badge badge-secondary"
        style={{ fontWeight: 700 }}
        title="Offline placeholder: the training sidecar is unreachable, so the real training status is unknown."
      >
        UNKNOWN (OFFLINE)
      </span>
    ) : m.training_status === "fully_trained" ? (
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
);
