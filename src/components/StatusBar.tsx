import React from "react";
import { HelpTooltip } from "./HelpTooltip";
import { MeshStatus } from "../api/types";

interface StatusBarProps {
  meshStatus: MeshStatus;
  backend: string;
  projectCount: number;
  lastUpdated: string | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  meshStatus,
  backend,
  projectCount,
  lastUpdated,
}) => {
  const allOnline = meshStatus.envManager && meshStatus.datasetCompiler && meshStatus.trainingSuite;
  const anyOnline = meshStatus.envManager || meshStatus.datasetCompiler || meshStatus.trainingSuite;
  return (
    <footer className="status-bar" role="contentinfo" aria-label="System Status Bar">
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }} role="status" aria-live="polite">
          {([
            { label: "Env Manager", port: 8000, online: meshStatus.envManager },
            { label: "Dataset Compiler", port: 8100, online: meshStatus.datasetCompiler },
            { label: "Training Suite", port: 8200, online: meshStatus.trainingSuite },
          ] as const).map(({ label, port, online }) => (
            <div key={port} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span
                className={`status-indicator ${online ? "status-online" : "status-offline"}`}
                aria-hidden="true"
              />
              <span style={{ fontSize: "11px", color: online ? "var(--text-secondary)" : "var(--text-muted)" }}>
                {label} (:{port})
              </span>
            </div>
          ))}
          <HelpTooltip
            content={`Sidecar mesh: Env Manager :8000 ${meshStatus.envManager ? "ONLINE" : "OFFLINE"}, Dataset Compiler :8100 ${meshStatus.datasetCompiler ? "ONLINE" : "OFFLINE"}, Training Suite :8200 ${meshStatus.trainingSuite ? "ONLINE" : "OFFLINE"}.`}
          />
        </div>

        <span aria-hidden="true">|</span>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            className={`status-indicator ${allOnline ? "status-online" : anyOnline ? "status-online" : "status-offline"}`}
            aria-hidden="true"
          />
          <span style={{ fontSize: "11px", fontWeight: 600, color: allOnline ? "var(--accent-cyan)" : "var(--accent-rose)" }}>
            {allOnline ? "Mesh Online" : anyOnline ? "Mesh Partial" : "Mesh Offline"}
          </span>
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
