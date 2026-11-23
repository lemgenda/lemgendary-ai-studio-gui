import React from "react";
import { HelpTooltip } from "./HelpTooltip";
import { MeshStatus } from "../api/types";
import { MESH_SERVICES } from "../api/config";

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
  const sidecars = [
    { label: "Env Manager", port: MESH_SERVICES["env-manager"].defaultPort, online: meshStatus.envManager },
    { label: "Dataset Compiler", port: MESH_SERVICES["dataset-compiler"].defaultPort, online: meshStatus.datasetCompiler },
    { label: "Training Suite", port: MESH_SERVICES["training-suite"].defaultPort, online: meshStatus.trainingSuite },
  ];
  return (
    <footer className="status-bar" role="contentinfo" aria-label="System Status Bar">
      <div className="status-bar-left">

        <div className="status-bar-sidecars" role="status" aria-live="polite">
          {sidecars.map(({ label, port, online }) => (
            <div key={label} className="status-bar-sidecar-item">
              <span
                className={`status-indicator ${online ? "status-online" : "status-offline"}`}
                aria-hidden="true"
              />
              <span className={online ? "status-bar-sidecar-label-online" : "status-bar-sidecar-label"}>
                {label} (:{port})
              </span>
            </div>
          ))}
          <HelpTooltip
            content={`Sidecar mesh: Env Manager :${MESH_SERVICES["env-manager"].defaultPort} ${meshStatus.envManager ? "ONLINE" : "OFFLINE"}, Dataset Compiler :${MESH_SERVICES["dataset-compiler"].defaultPort} ${meshStatus.datasetCompiler ? "ONLINE" : "OFFLINE"}, Training Suite :${MESH_SERVICES["training-suite"].defaultPort} ${meshStatus.trainingSuite ? "ONLINE" : "OFFLINE"}.`}
          />
        </div>

        <span aria-hidden="true">|</span>

        <div className="status-bar-group">
          <span
            className={`status-indicator ${allOnline ? "status-online" : anyOnline ? "status-online" : "status-offline"}`}
            aria-hidden="true"
          />
          <span className={allOnline ? "status-bar-mesh-online" : "status-bar-mesh-offline"}>
            {allOnline ? "Mesh Online" : anyOnline ? "Mesh Partial" : "Mesh Offline"}
          </span>
        </div>

        <span aria-hidden="true">|</span>
        <div className="status-bar-group">
          <span>Accelerator: {backend.toUpperCase()}</span>
          <HelpTooltip content={`Active hardware execution provider: ${backend.toUpperCase()}. Accelerates deep learning tensor operations.`} />
        </div>
        <span aria-hidden="true">|</span>
        <div className="status-bar-group">
          <span>Managed Projects: {projectCount}</span>
          <HelpTooltip content="Total discovered repositories in workspace governed by the LemGendary environment manager." />
        </div>
      </div>

      <div className="status-bar-group">
        <span>Last Synced: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "Never"}</span>
        <HelpTooltip content="Timestamp of the most recent hardware audit and ecosystem state synchronization." />
      </div>
    </footer>
  );
};

export default StatusBar;
