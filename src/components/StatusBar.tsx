import React from "react";

interface StatusBarProps {
  isConnected: boolean;
  backend: string;
  projectCount: number;
  lastUpdated: string | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  isConnected,
  backend,
  projectCount,
  lastUpdated,
}) => {
  return (
    <footer className="status-bar" role="contentinfo" aria-label="System Status Bar">
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center" }} role="status" aria-live="polite">
          <span
            className={`status-indicator ${isConnected ? "status-online" : "status-offline"}`}
            aria-hidden="true"
          />
          <span>{isConnected ? "Sidecar Server Online (Port 8000)" : "Sidecar Server Offline"}</span>
        </div>
        <span aria-hidden="true">|</span>
        <span>Accelerator: {backend.toUpperCase()}</span>
        <span aria-hidden="true">|</span>
        <span>Managed Projects: {projectCount}</span>
      </div>

      <div>
        <span>Last Synced: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "Never"}</span>
      </div>
    </footer>
  );
};
