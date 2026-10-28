import React, { useState } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { ValidationBanner } from "./common/ValidationBanner";
import { HealthAuditReport } from "../api/types";
import {
  triggerSafeUpdate,
  triggerDeepClean,
  installGitHooks,
  runEcosystemValidation,
} from "../api/client";

interface HealthPanelProps {
  report: HealthAuditReport | null;
  onStartEnvManager?: () => void;
}

export const HealthPanel: React.FC<HealthPanelProps> = ({ report, onStartEnvManager }) => {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [isInstallingHooks, setIsInstallingHooks] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [maintenanceFeedback, setMaintenanceFeedback] = useState<string | null>(null);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  if (!report) {
    return (
      <section className="card" aria-labelledby="health-offline-title">
        <div className="card-title">
          <h3 id="health-offline-title" style={{ fontSize: "16px", fontWeight: 600 }}>
            Ecosystem Health &amp; Version Drift
          </h3>
          <span className="badge badge-error" aria-label="Sidecar offline">OFFLINE</span>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "16px" }}>
          Health audit requires Environment Manager (Port 8000).
          Launch it to populate the toolchain prerequisite matrix and cross-project version drift table.
        </p>
        {onStartEnvManager && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onStartEnvManager}
            aria-label="Launch the Environment Manager sidecar on Port 8000"
          >
            Start Environment Manager
          </button>
        )}
      </section>
    );
  }

  const handleSafeUpdate = async (dryRun: boolean = false) => {
    setIsUpdating(true);
    setMaintenanceFeedback(null);
    setMaintenanceError(null);
    try {
      const res = await triggerSafeUpdate(dryRun);
      setMaintenanceFeedback(
        dryRun
          ? "Safe upgrade dry run complete. See logs for package version diffs."
          : `Safe package update initiated (Status: ${res.status}).`
      );
    } catch (err: unknown) {
      setMaintenanceError(`Safe update failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeepClean = async () => {
    setIsCleaning(true);
    setMaintenanceFeedback(null);
    setMaintenanceError(null);
    try {
      const res = await triggerDeepClean();
      setMaintenanceFeedback(`Deep clean complete: Purged ${res.cleaned_count} cache artifacts, reclaimed ${res.reclaimed_mb} MB.`);
    } catch (err: unknown) {
      setMaintenanceError(`Deep clean failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleInstallHooks = async () => {
    setIsInstallingHooks(true);
    setMaintenanceFeedback(null);
    setMaintenanceError(null);
    try {
      const res = await installGitHooks();
      const summary = res.results.map((r) => `${r.project}: ${r.success ? "OK" : "Failed"}`).join(" | ");
      setMaintenanceFeedback(`Pre-commit git hooks installed across projects: ${summary}`);
    } catch (err: unknown) {
      setMaintenanceError(`Hooks installation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsInstallingHooks(false);
    }
  };

  const handleValidateEcosystem = async () => {
    setIsValidating(true);
    setMaintenanceFeedback(null);
    setMaintenanceError(null);
    try {
      const res = await runEcosystemValidation();
      setMaintenanceFeedback(
        res.all_passed
          ? "Full ecosystem codebase validation passed (py_compile, HTML/W3C, YAML, Git hooks)."
          : "Ecosystem validation reported violations. Check log stream for details."
      );
    } catch (err: unknown) {
      setMaintenanceError(`Validation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsValidating(false);
    }
  };

  const pythonProjects = report.projects.filter(
    (p) => p.name !== "lemgendary-ai-studio-gui"
  );
  const projNames = pythonProjects.map((p) => p.name);
  const guiProject = report.projects.find((p) => p.name === "lemgendary-ai-studio-gui");

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

        <div style={{ overflowX: "auto", marginTop: "12px", maxHeight: "360px", overflowY: "auto" }}>
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

      {guiProject && (
        <section className="card" aria-labelledby="gui-dependencies-title">
          <div className="card-title">
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <h3 id="gui-dependencies-title" style={{ fontSize: "16px", fontWeight: 600 }}>Desktop GUI Project Packages (NPM)</h3>
              <HelpTooltip content="Node.js and Tauri ecosystem packages managed via package.json. Desktop UI runs independently of Python virtual environments." />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className={`badge ${guiProject.is_healthy ? "badge-success" : "badge-error"}`}>
                {guiProject.is_healthy ? "NODE_MODULES READY" : "ATTENTION REQUIRED"}
              </span>
              <HelpTooltip content={guiProject.is_healthy ? "All direct and dev dependencies installed in node_modules." : "node_modules missing or incomplete. Run npm install to resolve."} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginTop: "12px" }}>
            <div className="metric-row">
              <span className="metric-label">Runtime Engine</span>
              <span className="metric-value">Node.js LTS (npm)</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Direct Dependencies</span>
              <span className="metric-value">{guiProject.total_required} declared</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Installed Packages</span>
              <span className="metric-value">{guiProject.total_installed} packages</span>
            </div>
          </div>

          {Object.keys(guiProject.installed_packages).length > 0 && (
            <div style={{ marginTop: "16px", overflowX: "auto", maxHeight: "360px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", textAlign: "left", color: "var(--text-muted)" }}>
                    <th scope="col" style={{ padding: "8px 12px" }}>Package Name</th>
                    <th scope="col" style={{ padding: "8px 12px" }}>Installed Version</th>
                    <th scope="col" style={{ padding: "8px 12px" }}>Category</th>
                    <th scope="col" style={{ padding: "8px 12px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(guiProject.installed_packages).map(([pkg, ver]) => (
                    <tr key={pkg} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                      <th scope="row" style={{ padding: "8px 12px", color: "var(--accent-cyan)", fontWeight: 500, textAlign: "left" }}>
                        {pkg}
                      </th>
                      <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{ver}</td>
                      <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>
                        {pkg.startsWith("@types") || pkg.includes("eslint") || pkg === "typescript" || pkg === "vite" || pkg === "vitest" ? "Dev Dependency" : "Production Dependency"}
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <span className="badge badge-success">INSTALLED</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ─── ECOSYSTEM MAINTENANCE & GOVERNANCE ACTIONS ─── */}
      <section className="card" aria-labelledby="maintenance-actions-title">
        <div className="card-title">
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <h3 id="maintenance-actions-title" style={{ fontSize: "16px", fontWeight: 600 }}>
              Ecosystem Maintenance &amp; Governance
            </h3>
            <HelpTooltip content="Operational maintenance routines executed by Environment Manager (Port 8000): non-breaking bottom-up package upgrades, deep cache purges, git hook synchronization, and multi-linter validation." />
          </div>
          <span className="badge badge-info">MAINTENANCE</span>
        </div>

        <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "16px" }}>
          One-click ecosystem maintenance routines enforcing zero-drift dependency alignment, clean workspace caches, and standardized pre-commit validation hooks.
        </p>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
          <button
            id="health-btn-safe-upgrade"
            type="button"
            className="btn btn-primary"
            onClick={() => handleSafeUpdate(false)}
            disabled={isUpdating}
            style={{ fontSize: "12px", padding: "8px 14px", fontWeight: 600 }}
          >
            {isUpdating ? "Upgrading Packages..." : "Safe Package Upgrade"}
          </button>

          <button
            id="health-btn-upgrade-dry-run"
            type="button"
            className="btn btn-secondary"
            onClick={() => handleSafeUpdate(true)}
            disabled={isUpdating}
            style={{ fontSize: "12px", padding: "8px 14px" }}
          >
            Upgrade Dry Run
          </button>

          <button
            id="health-btn-deep-clean"
            type="button"
            className="btn btn-secondary"
            onClick={handleDeepClean}
            disabled={isCleaning}
            style={{ fontSize: "12px", padding: "8px 14px" }}
          >
            {isCleaning ? "Purging Caches..." : "Deep Cache Purge"}
          </button>

          <button
            id="health-btn-install-hooks"
            type="button"
            className="btn btn-secondary"
            onClick={handleInstallHooks}
            disabled={isInstallingHooks}
            style={{ fontSize: "12px", padding: "8px 14px" }}
          >
            {isInstallingHooks ? "Configuring Hooks..." : "Install Git Hooks"}
          </button>

          <button
            id="health-btn-validate-ecosystem"
            type="button"
            className="btn btn-secondary"
            onClick={handleValidateEcosystem}
            disabled={isValidating}
            style={{ fontSize: "12px", padding: "8px 14px" }}
          >
            {isValidating ? "Validating Ecosystem..." : "Run Ecosystem Validation"}
          </button>
        </div>

        {maintenanceFeedback && (
          <ValidationBanner
            type="success"
            message={maintenanceFeedback}
            style={{ fontSize: "12px", marginTop: "10px" }}
          />
        )}

        {maintenanceError && (
          <ValidationBanner
            type="error"
            message={maintenanceError}
            style={{ fontSize: "12px", marginTop: "10px" }}
          />
        )}
      </section>
    </div>
  );
};

export default HealthPanel;
