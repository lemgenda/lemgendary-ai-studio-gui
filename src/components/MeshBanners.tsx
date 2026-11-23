import React from "react";
import { servicePortList } from "../api/config";

interface MeshOfflineBannerProps {
  startingServiceId: string | null;
  onStartAll: () => void;
}

/** Global banner shown across all tabs when the entire mesh is down. */
export const MeshOfflineBanner: React.FC<MeshOfflineBannerProps> = ({ startingServiceId, onStartAll }) => (
  <div role="alert" className="mesh-offline-banner">
    <span className="mesh-offline-text">
      Ecosystem mesh offline. All three sidecars (Ports {servicePortList()}) are unreachable.
    </span>
    <button
      type="button"
      className="btn btn-primary btn-font-sm"
      onClick={onStartAll}
      disabled={startingServiceId !== null}
      aria-label="Start all LemGendary ecosystem sidecars"
    >
      {startingServiceId === "all" ? "Starting Services..." : "Start All Services"}
    </button>
  </div>
);

interface RefreshErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

/** Dismissible banner for refresh, pipeline and service lifecycle failures. */
export const RefreshErrorBanner: React.FC<RefreshErrorBannerProps> = ({ message, onDismiss }) => (
  <div role="alert" className="mesh-error-banner">
    <span className="mesh-error-text">{message}</span>
    <div className="row-gap-md btn-icon-fixed">
      <button
        type="button"
        className="btn btn-secondary btn-dismiss-sm"
        onClick={onDismiss}
        aria-label="Dismiss error message"
      >
        Dismiss
      </button>
    </div>
  </div>
);
