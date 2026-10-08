import React from "react";
import { HelpTooltip } from "./HelpTooltip";
import { ProjectHealth } from "../api/types";

interface ProjectCardProps {
  project: ProjectHealth;
  onInstall: (projectName: string) => void;
  isProcessing: boolean;
  isOffline?: boolean;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onInstall,
  isProcessing,
  isOffline = false,
}) => {
  const headingId = `proj-title-${project.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  return (
    <article className="card" aria-labelledby={headingId}>
      <div className="card-title">
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <h3 id={headingId} style={{ fontSize: "15px", fontWeight: 600 }}>{project.name}</h3>
          <HelpTooltip content={`Discovered workspace project at ${project.project_dir}. Managed via SSOT requirements manifest.`} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            className={`badge ${isOffline ? "badge-warning" : project.is_healthy ? "badge-success" : "badge-warning"}`}
            aria-label={`Project status: ${isOffline ? "Unknown" : project.is_healthy ? "Healthy" : "Attention required"}`}
          >
            {isOffline ? "UNKNOWN" : project.is_healthy ? "HEALTHY" : "ATTENTION"}
          </span>
          <HelpTooltip content={isOffline ? "Status unavailable — Environment Manager (Port 8000) is offline." : project.is_healthy ? "All required packages installed without missing dependencies." : "One or more required packages are missing or mismatched."} />
        </div>
      </div>

      <div className="metric-row">
        <span className="metric-label">{project.name.includes("gui") ? "Package Manager" : "Virtual Environment"}</span>
        <span className="metric-value">
          {project.name.includes("gui")
            ? (project.venv_exists ? "Operational (node_modules)" : "Missing")
            : (project.venv_exists ? "Operational (.venv)" : "Missing")}
        </span>
      </div>

      <div className="metric-row">
        <span className="metric-label">{project.name.includes("gui") ? "Runtime Environment" : "Python Environment"}</span>
        <span className="metric-value">{project.python_version || (project.name.includes("gui") ? "Node.js (npm)" : "N/A")}</span>
      </div>

      <div className="metric-row">
        <span className="metric-label">{project.name.includes("gui") ? "Installed / Direct Deps" : "Installed / Required"}</span>
        <span className="metric-value">
          {isOffline ? "-- / --" : `${project.total_installed} / ${project.total_required}`}
        </span>
      </div>

      <div className="metric-row">
        <span className="metric-label">Missing Packages</span>
        <span className="metric-value" style={{ color: !isOffline && project.missing_packages.length > 0 ? "var(--accent-rose)" : "inherit" }}>
          {isOffline ? "--" : project.missing_packages.length}
        </span>
      </div>

      {project.missing_packages.length > 0 && (
        <div style={{ marginTop: "10px", fontSize: "11px", color: "var(--accent-rose)", fontFamily: "var(--font-mono)" }}>
          Missing: {project.missing_packages.slice(0, 4).join(", ")}
          {project.missing_packages.length > 4 ? ` +${project.missing_packages.length - 4} more` : ""}
        </div>
      )}

      <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: "100%", fontSize: "12px" }}
          onClick={() => onInstall(project.name)}
          disabled={isProcessing || isOffline}
          aria-label={isOffline ? `Reconcile unavailable for ${project.name} — Environment Manager offline` : `Reconcile environment for project ${project.name}`}
          aria-disabled={isOffline}
          aria-busy={isProcessing}
        >
          {isProcessing ? "Processing..." : isOffline ? "Reconcile Environment (Sidecar Required)" : "Reconcile Environment"}
        </button>
        <HelpTooltip content={isOffline ? "Reconcile requires Environment Manager (Port 8000) to be running." : `Reconciles virtual environment for ${project.name}. Synchronizes pip wheels to match the SSOT manifest.`} />
      </div>
    </article>
  );
};

export default ProjectCard;
