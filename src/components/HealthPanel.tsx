import React, { useState } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { ValidationBanner } from "./common/ValidationBanner";
import { ConfirmDialog } from "./common/ConfirmDialog";
import { HealthAuditReport } from "../api/types";
import {
  triggerSafeUpdate,
  triggerDeepClean,
  installGitHooks,
  runEcosystemValidation,
} from "../api/client";
import { servicePort } from "../api/config";
import { guiProjectFolder } from "../api/ecosystem";

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
  /** Destructive maintenance action waiting for confirmation. */
  const [pendingAction, setPendingAction] = useState<"upgrade" | "purge" | null>(null);
  if (!report) {
    return (
      <section className="card" aria-labelledby="health-offline-title">
        <div className="card-title">
          <h3 id="health-offline-title" className="card-heading">
            Ecosystem Health &amp; Version Drift
          </h3>
          <span className="badge badge-error" aria-label="Sidecar offline">OFFLINE</span>
        </div>
        <p className="offline-card-desc">
          Health audit requires Environment Manager (Port {servicePort("env-manager")}).
          Launch it to populate the toolchain prerequisite matrix and cross-project version drift table.
        </p>
        {onStartEnvManager && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onStartEnvManager}
            aria-label={`Launch the Environment Manager sidecar on Port ${servicePort("env-manager")}`}
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
          : res.status === "accepted"
            ? `Safe package update started in the background (job ${res.job_id ?? "unknown"}). Progress appears in the logs.`
            : `Safe package update: ${res.status}.`
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
    (p) => p.name !== guiProjectFolder()
  );
  const projNames = pythonProjects.map((p) => p.name);
  const guiProject = report.projects.find((p) => p.name === guiProjectFolder());

  return (
    <div className="stack-xl">
      <section className="card" aria-labelledby="toolchain-prereq-title">
        <div className="card-title">
          <div className="row-gap-sm">
            <h3 id="toolchain-prereq-title" className="card-heading">Toolchain Prerequisites</h3>
            <HelpTooltip content="Audits global developer toolchains on the host operating system: Python 3.12+, Git SCM, and Node.js LTS engine." />
          </div>
          <div className="row-gap-sm">
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
          <div className="health-prereq-alert">
            <div className="health-prereq-title">
              Missing Toolchains:
            </div>
            {report.bootstrap.remediation_instructions.map((inst, i) => (
              <div key={i} className="health-prereq-item">
                {inst}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="drift-matrix-title">
        <div className="card-title">
          <div className="row-gap-sm">
            <h3 id="drift-matrix-title" className="card-heading">Cross-Project Package Version Drift Matrix</h3>
            <HelpTooltip content="Compares package versions across all project virtual environments. Highlights version drift where different projects run conflicting dependency releases." />
          </div>
          <div className="row-gap-sm">
            <span
              className={`badge ${report.version_drift.some((d) => d.has_drift) ? "badge-warning" : "badge-success"}`}
              aria-label={`Drift status: ${report.version_drift.some((d) => d.has_drift) ? "Version drift observed" : "Synchronized"}`}
            >
              {report.version_drift.some((d) => d.has_drift) ? "VERSION DRIFT OBSERVED" : "SYNCHRONIZED"}
            </span>
            <HelpTooltip content={report.version_drift.some((d) => d.has_drift) ? "Version differences detected across virtual environments. Reconcile projects to resolve drift." : "All shared packages across virtual environments are synchronized."} />
          </div>
        </div>

        <div className="data-table-scroll-box">
          <table className="data-table-mono">
            <caption className="sr-only">Cross-Project Package Version Drift Matrix comparing package versions across projects</caption>
            <thead>
              <tr className="data-table-head-row">
                <th scope="col" className="data-table-cell">Package</th>
                {projNames.map((name) => (
                  <th key={name} scope="col" className="data-table-cell">{name}</th>
                ))}
                <th scope="col" className="data-table-cell">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.version_drift.map((drift) => (
                <tr key={drift.package_name} className="data-table-row">
                  <th scope="row" className="data-table-th-key">
                    {drift.package_name}
                  </th>
                  {projNames.map((pName) => (
                    <td key={pName} className="data-table-td-secondary">
                      {drift.versions[pName] || "-"}
                    </td>
                  ))}
                  <td className="data-table-cell">
                    <div className="row-gap-sm">
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
            <div className="row-gap-sm">
              <h3 id="gui-dependencies-title" className="card-heading">Desktop GUI Project Packages (NPM)</h3>
              <HelpTooltip content="Node.js and Tauri ecosystem packages managed via package.json. Desktop UI runs independently of Python virtual environments." />
            </div>
            <div className="row-gap-sm">
              <span className={`badge ${guiProject.is_healthy ? "badge-success" : "badge-error"}`}>
                {guiProject.is_healthy ? "NODE_MODULES READY" : "ATTENTION REQUIRED"}
              </span>
              <HelpTooltip content={guiProject.is_healthy ? "All direct and dev dependencies installed in node_modules." : "node_modules missing or incomplete. Run npm install to resolve."} />
            </div>
          </div>

          <div className="health-npm-grid">
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
            <div className="data-table-scroll-box-lg">
              <table className="data-table-mono">
                <thead>
                  <tr className="data-table-head-row">
                    <th scope="col" className="data-table-cell">Package Name</th>
                    <th scope="col" className="data-table-cell">Installed Version</th>
                    <th scope="col" className="data-table-cell">Category</th>
                    <th scope="col" className="data-table-cell">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(guiProject.installed_packages).map(([pkg, ver]) => (
                    <tr key={pkg} className="data-table-row">
                      <th scope="row" className="data-table-th-key">
                        {pkg}
                      </th>
                      <td className="data-table-td-secondary">{ver}</td>
                      <td className="data-table-td-muted">
                        {pkg.startsWith("@types") || pkg.includes("eslint") || pkg === "typescript" || pkg === "vite" || pkg === "vitest" ? "Dev Dependency" : "Production Dependency"}
                      </td>
                      <td className="data-table-cell">
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
          <div className="row-gap-sm">
            <h3 id="maintenance-actions-title" className="card-heading">
              Ecosystem Maintenance &amp; Governance
            </h3>
            <HelpTooltip content={`Operational maintenance routines executed by Environment Manager (Port ${servicePort("env-manager")}): non-breaking bottom-up package upgrades, deep cache purges, git hook synchronization, and multi-linter validation.`} />
          </div>
          <span className="badge badge-info">MAINTENANCE</span>
        </div>

        <p className="health-intro-desc">
          One-click ecosystem maintenance routines enforcing zero-drift dependency alignment, clean workspace caches, and standardized pre-commit validation hooks.
        </p>

        <div className="health-actions-row">
          <button
            id="health-btn-safe-upgrade"
            type="button"
            className="btn btn-primary btn-maintenance-primary"
            onClick={() => setPendingAction("upgrade")}
            disabled={isUpdating}
          >
            {isUpdating ? "Upgrading Packages..." : "Safe Package Upgrade"}
          </button>

          <button
            id="health-btn-upgrade-dry-run"
            type="button"
            className="btn btn-secondary btn-maintenance"
            onClick={() => handleSafeUpdate(true)}
            disabled={isUpdating}
          >
            Upgrade Dry Run
          </button>

          <button
            id="health-btn-deep-clean"
            type="button"
            className="btn btn-secondary btn-maintenance"
            onClick={() => setPendingAction("purge")}
            disabled={isCleaning}
          >
            {isCleaning ? "Purging Caches..." : "Deep Cache Purge"}
          </button>

          <button
            id="health-btn-install-hooks"
            type="button"
            className="btn btn-secondary btn-maintenance"
            onClick={handleInstallHooks}
            disabled={isInstallingHooks}
          >
            {isInstallingHooks ? "Configuring Hooks..." : "Install Git Hooks"}
          </button>

          <button
            id="health-btn-validate-ecosystem"
            type="button"
            className="btn btn-secondary btn-maintenance"
            onClick={handleValidateEcosystem}
            disabled={isValidating}
          >
            {isValidating ? "Validating Ecosystem..." : "Run Ecosystem Validation"}
          </button>
        </div>

        {maintenanceFeedback && (
          <ValidationBanner
            type="success"
            message={maintenanceFeedback}
            className="banner-space-top-xs banner-text-sm"
          />
        )}

        {maintenanceError && (
          <ValidationBanner
            type="error"
            message={maintenanceError}
            className="banner-space-top-xs banner-text-sm"
          />
        )}
      </section>

      <ConfirmDialog
        isOpen={pendingAction !== null}
        id="health-dialog-confirm"
        title={pendingAction === "purge" ? "Purge workspace caches?" : "Upgrade packages?"}
        message={
          pendingAction === "purge"
            ? "Deep Cache Purge deletes __pycache__ folders, build caches and temporary artifacts across all workspace projects. They are rebuilt on the next run, which can be slow."
            : "Safe Package Upgrade installs newer package versions into every project virtual environment. Run Upgrade Dry Run first to see what would change."
        }
        confirmLabel={pendingAction === "purge" ? "Purge caches" : "Upgrade packages"}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          const action = pendingAction;
          setPendingAction(null);
          if (action === "purge") void handleDeepClean();
          else if (action === "upgrade") void handleSafeUpdate(false);
        }}
      />
    </div>
  );
};

export default HealthPanel;
