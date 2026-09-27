import React from "react";
import { HelpTooltip } from "./HelpTooltip";

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
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }} role="status" aria-live="polite">
          <span
            className={`status-indicator ${isConnected ? "status-online" : "status-offline"}`}
            aria-hidden="true"
          />
          <span>{isConnected ? "Sidecar Mesh Online (Ports 8000, 8100, 8200)" : "Sidecar Server Offline"}</span>
          <HelpTooltip content="Local microservice status. Coordinates lemgendary-env-manager (8000), lemgendary-datasets (8100), and lemgendary-training-suite (8200)." />
        </div>
        <span aria-hidden="true">|</span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span>Accelerator: {backend.toUpperCase()}</span>
          <HelpTooltip content={`Active hardware execution provider: ${backend.toUpperCase()}. Accelerates deep learning tensor operations.`} />
        </div>
        <span aria-hidden="true">|</span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span>Managed Projects: {projectCount}</span>
          <HelpTooltip content="Total discovered repositories in workspace governed by the LemGendary environment manager." />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span>Last Synced: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "Never"}</span>
        <HelpTooltip content="Timestamp of the most recent hardware audit and ecosystem state synchronization." />
      </div>
    </footer>
  );
};

export default StatusBar;
