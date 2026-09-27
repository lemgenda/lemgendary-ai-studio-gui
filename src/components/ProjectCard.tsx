import React from "react";
import { HelpTooltip } from "./HelpTooltip";
import { ProjectHealth } from "../api/types";

interface ProjectCardProps {
  project: ProjectHealth;
  onInstall: (projectName: string) => void;
  isProcessing: boolean;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onInstall,
  isProcessing,
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
            className={`badge ${project.is_healthy ? "badge-success" : "badge-warning"}`}
            aria-label={`Project status: ${project.is_healthy ? "Healthy" : "Attention required"}`}
          >
            {project.is_healthy ? "HEALTHY" : "ATTENTION"}
          </span>
          <HelpTooltip content={project.is_healthy ? "All required packages installed without missing dependencies." : "One or more required packages are missing or mismatched."} />
        </div>
      </div>

      <div className="metric-row">
        <span className="metric-label">Virtual Environment</span>
        <span className="metric-value">
          {project.venv_exists ? "Operational (.venv)" : "Missing"}
        </span>
      </div>

      <div className="metric-row">
        <span className="metric-label">Python Environment</span>
        <span className="metric-value">{project.python_version || "N/A"}</span>
      </div>

      <div className="metric-row">
        <span className="metric-label">Installed / Required</span>
        <span className="metric-value">
          {project.total_installed} / {project.total_required}
        </span>
      </div>

      <div className="metric-row">
        <span className="metric-label">Missing Packages</span>
        <span className="metric-value" style={{ color: project.missing_packages.length > 0 ? "var(--accent-rose)" : "inherit" }}>
          {project.missing_packages.length}
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
          disabled={isProcessing}
          aria-label={`Reconcile environment for project ${project.name}`}
          aria-busy={isProcessing}
        >
          {isProcessing ? "Processing..." : "Reconcile Environment"}
        </button>
        <HelpTooltip content={`Reconciles virtual environment for ${project.name}. Synchronizes pip wheels to match the SSOT manifest.`} />
      </div>
    </article>
  );
};

export default ProjectCard;
