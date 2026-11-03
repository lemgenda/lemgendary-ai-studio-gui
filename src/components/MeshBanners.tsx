import React from "react";
import { servicePortList } from "../api/config";

interface MeshOfflineBannerProps {
  startingServiceId: string | null;
  onStartAll: () => void;
}

/** Global banner shown across all tabs when the entire mesh is down. */
export const MeshOfflineBanner: React.FC<MeshOfflineBannerProps> = ({ startingServiceId, onStartAll }) => (
  <div
    role="alert"
    style={{
      padding: "12px 20px",
      backgroundColor: "rgba(244, 63, 94, 0.12)",
      border: "1px solid var(--accent-rose)",
      borderRadius: "var(--radius-sm)",
      marginBottom: "16px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}
  >
    <span style={{ fontSize: "13px", color: "var(--accent-rose)", fontWeight: 600 }}>
      Ecosystem mesh offline. All three sidecars (Ports {servicePortList()}) are unreachable.
    </span>
    <button
      type="button"
      className="btn btn-primary"
      style={{ fontSize: "12px" }}
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
  <div
    role="alert"
    style={{
      padding: "10px 16px",
      backgroundColor: "rgba(251, 146, 60, 0.10)",
      border: "1px solid var(--accent-amber, #f59e0b)",
      borderRadius: "var(--radius-sm)",
      marginBottom: "16px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px",
    }}
  >
    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{message}</span>
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ fontSize: "11px", padding: "2px 10px" }}
        onClick={onDismiss}
        aria-label="Dismiss error message"
      >
        Dismiss
      </button>
    </div>
  </div>
);
