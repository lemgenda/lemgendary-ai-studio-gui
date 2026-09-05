import React from "react";
import { HealthAuditReport } from "../api/types";

interface HealthPanelProps {
  report: HealthAuditReport | null;
}

export const HealthPanel: React.FC<HealthPanelProps> = ({ report }) => {
  if (!report) {
    return (
      <div className="card">
        <h3 className="card-title">Ecosystem Health & Version Drift</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading health matrix...</p>
      </div>
    );
  }

  const projNames = report.projects.map((p) => p.name);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="card">
        <div className="card-title">
          <span>Toolchain Prerequisites</span>
          <span className={`badge ${report.bootstrap.python_valid && report.bootstrap.git_installed ? "badge-success" : "badge-error"}`}>
            {report.bootstrap.python_valid && report.bootstrap.git_installed ? "ALL PREREQUISITES VERIFIED" : "ATTENTION REQUIRED"}
          </span>
        </div>

        <div className="metric-row">
          <span className="metric-label">Global Python</span>
          <span className="metric-value">
            {report.bootstrap.python_valid ? `Verified (${report.bootstrap.python_version})` : "Missing or Incompatible (<3.10)"}
          </span>
        </div>

        <div className="metric-row">
          <span className="metric-label">Git SCM</span>
          <span className="metric-value">
            {report.bootstrap.git_installed ? `Operational (${report.bootstrap.git_version})` : "Not Detected"}
          </span>
        </div>

        <div className="metric-row">
          <span className="metric-label">Node / NPM Engine</span>
          <span className="metric-value">
            {report.bootstrap.npm_installed ? `Installed (${report.bootstrap.npm_version})` : "Not Found"}
          </span>
        </div>

        {report.bootstrap.missing_prerequisites.length > 0 && (
          <div style={{ marginTop: "12px", padding: "12px", backgroundColor: "rgba(244, 63, 94, 0.1)", borderRadius: "var(--radius-sm)" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-rose)", marginBottom: "4px" }}>
              Missing Toolchains:
            </div>
            {report.bootstrap.remediation_instructions.map((inst, i) => (
              <div key={i} style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                {inst}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <span>Cross-Project Package Version Drift Matrix</span>
          <span className={`badge ${report.version_drift.some((d) => d.has_drift) ? "badge-warning" : "badge-success"}`}>
            {report.version_drift.some((d) => d.has_drift) ? "VERSION DRIFT OBSERVED" : "SYNCHRONIZED"}
          </span>
        </div>

        <div style={{ overflowX: "auto", marginTop: "12px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)", textAlign: "left", color: "var(--text-muted)" }}>
                <th style={{ padding: "8px 12px" }}>Package</th>
                {projNames.map((name) => (
                  <th key={name} style={{ padding: "8px 12px" }}>{name}</th>
                ))}
                <th style={{ padding: "8px 12px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {report.version_drift.map((drift) => (
                <tr key={drift.package_name} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                  <td style={{ padding: "8px 12px", color: "var(--accent-cyan)", fontWeight: 500 }}>
                    {drift.package_name}
                  </td>
                  {projNames.map((pName) => (
                    <td key={pName} style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>
                      {drift.versions[pName] || "-"}
                    </td>
                  ))}
                  <td style={{ padding: "8px 12px" }}>
                    <span className={`badge ${drift.has_drift ? "badge-warning" : "badge-success"}`}>
                      {drift.has_drift ? "DRIFT" : "SYNC"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
