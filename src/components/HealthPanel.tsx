import React from "react";
import { HelpTooltip } from "./HelpTooltip";
import { HealthAuditReport } from "../api/types";

interface HealthPanelProps {
  report: HealthAuditReport | null;
}

export const HealthPanel: React.FC<HealthPanelProps> = ({ report }) => {
  if (!report) {
    return (
      <div className="card">
        <h3 className="card-title">Ecosystem Health &amp; Version Drift</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading health matrix...</p>
      </div>
    );
  }

  const projNames = report.projects.map((p) => p.name);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <section className="card" aria-labelledby="toolchain-prereq-title">
        <div className="card-title">
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <h3 id="toolchain-prereq-title" style={{ fontSize: "16px", fontWeight: 600 }}>Toolchain Prerequisites</h3>
            <HelpTooltip content="Audits global developer toolchains on the host operating system: Python 3.12+, Git SCM, and Node.js LTS engine." />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              className={`badge ${report.bootstrap.python_valid && report.bootstrap.git_installed ? "badge-success" : "badge-error"}`}
              aria-label={`Toolchain status: ${report.bootstrap.python_valid && report.bootstrap.git_installed ? "All prerequisites verified" : "Attention required"}`}
            >
              {report.bootstrap.python_valid && report.bootstrap.git_installed ? "ALL PREREQUISITES VERIFIED" : "ATTENTION REQUIRED"}
            </span>
            <HelpTooltip content={report.bootstrap.python_valid && report.bootstrap.git_installed ? "All host toolchains meet ecosystem requirements." : "One or more required toolchains are missing or outdated."} />
          </div>
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
      </section>

      <section className="card" aria-labelledby="drift-matrix-title">
        <div className="card-title">
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <h3 id="drift-matrix-title" style={{ fontSize: "16px", fontWeight: 600 }}>Cross-Project Package Version Drift Matrix</h3>
            <HelpTooltip content="Compares package versions across all project virtual environments. Highlights version drift where different projects run conflicting dependency releases." />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              className={`badge ${report.version_drift.some((d) => d.has_drift) ? "badge-warning" : "badge-success"}`}
              aria-label={`Drift status: ${report.version_drift.some((d) => d.has_drift) ? "Version drift observed" : "Synchronized"}`}
            >
              {report.version_drift.some((d) => d.has_drift) ? "VERSION DRIFT OBSERVED" : "SYNCHRONIZED"}
            </span>
            <HelpTooltip content={report.version_drift.some((d) => d.has_drift) ? "Version differences detected across virtual environments. Reconcile projects to resolve drift." : "All shared packages across virtual environments are synchronized."} />
          </div>
        </div>

        <div style={{ overflowX: "auto", marginTop: "12px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
            <caption className="sr-only">Cross-Project Package Version Drift Matrix comparing package versions across projects</caption>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)", textAlign: "left", color: "var(--text-muted)" }}>
                <th scope="col" style={{ padding: "8px 12px" }}>Package</th>
                {projNames.map((name) => (
                  <th key={name} scope="col" style={{ padding: "8px 12px" }}>{name}</th>
                ))}
                <th scope="col" style={{ padding: "8px 12px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {report.version_drift.map((drift) => (
                <tr key={drift.package_name} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                  <th scope="row" style={{ padding: "8px 12px", color: "var(--accent-cyan)", fontWeight: 500, textAlign: "left" }}>
                    {drift.package_name}
                  </th>
                  {projNames.map((pName) => (
                    <td key={pName} style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>
                      {drift.versions[pName] || "-"}
                    </td>
                  ))}
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className={`badge ${drift.has_drift ? "badge-warning" : "badge-success"}`}>
                        {drift.has_drift ? "DRIFT" : "SYNC"}
                      </span>
                      <HelpTooltip content={drift.has_drift ? `Package ${drift.package_name} has mismatched versions across projects.` : `Package ${drift.package_name} is identically pinned across all manifests.`} position="left" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default HealthPanel;
