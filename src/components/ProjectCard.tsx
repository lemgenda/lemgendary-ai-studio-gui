import React from "react";
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
  return (
    <div className="card">
      <div className="card-title">
        <span>{project.name}</span>
        <span className={`badge ${project.is_healthy ? "badge-success" : "badge-warning"}`}>
          {project.is_healthy ? "HEALTHY" : "ATTENTION"}
        </span>
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

      <div style={{ marginTop: "16px" }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: "100%", fontSize: "12px" }}
          onClick={() => onInstall(project.name)}
          disabled={isProcessing}
        >
          {isProcessing ? "Processing..." : "Reconcile Environment"}
        </button>
      </div>
    </div>
  );
};
