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
    <footer className="status-bar">
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span className={`status-indicator ${isConnected ? "status-online" : "status-offline"}`} />
          <span>{isConnected ? "Sidecar Server Online (Port 8000)" : "Sidecar Server Offline"}</span>
        </div>
        <span>|</span>
        <span>Accelerator: {backend.toUpperCase()}</span>
        <span>|</span>
        <span>Managed Projects: {projectCount}</span>
      </div>

      <div>
        <span>Last Synced: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "Never"}</span>
      </div>
    </footer>
  );
};
