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
  const [updatingPackage, setUpdatingPackage] = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [isInstallingHooks, setIsInstallingHooks] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [maintenanceFeedback, setMaintenanceFeedback] = useState<string | null>(null);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [latestVersions, setLatestVersions] = useState<Record<string, string>>({});
  /** Destructive maintenance action waiting for confirmation. */
  const [pendingAction, setPendingAction] = useState<"purge" | null>(null);

  // Probe dry-run plan on mount / report change to populate latest stable versions for PIP and NPM packages
  React.useEffect(() => {
    let isCancelled = false;
    const fetchLatestVersions = async () => {
      try {
        const res = await triggerSafeUpdate(true);
        if (isCancelled || !res.plan) return;
        const plan = res.plan as {
          projects?: Array<{
            name: string;
            outdated_packages?: Array<{
              name: string;
              latest_version?: string;
              current_version?: string;
            }>;
            safe_packages?: Array<{
              name: string;
              latest_version?: string;
            }>;
          }>;
        };
        const latestMap: Record<string, string> = {};
        if (Array.isArray(plan.projects)) {
          for (const proj of plan.projects) {
            if (Array.isArray(proj.outdated_packages)) {
              for (const pkg of proj.outdated_packages) {
                if (pkg.name && pkg.latest_version) {
                  latestMap[pkg.name.toLowerCase().replace(/[-_.]+/g, "-")] = pkg.latest_version;
                  latestMap[pkg.name] = pkg.latest_version;
                }
              }
            }
          }
        }
        setLatestVersions((prev) => ({ ...prev, ...latestMap }));
      } catch (err) {
        console.warn("[LemGendary AI Studio] Failed to probe latest package versions:", err);
      }
    };
    void fetchLatestVersions();
    return () => {
      isCancelled = true;
    };
  }, [report]);
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

  const handleSafeUpdate = async (dryRun: boolean = false, project?: string, pkgName?: string) => {
    setIsUpdating(true);
    if (pkgName) setUpdatingPackage(pkgName);
    setMaintenanceFeedback(null);
    setMaintenanceError(null);
    try {
      const res = await triggerSafeUpdate(dryRun, project);
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
      setUpdatingPackage(null);
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
                <th scope="col" className="data-table-cell">Latest Version</th>
                <th scope="col" className="data-table-cell">Status</th>
                <th scope="col" className="data-table-cell">
                  <button
                    type="button"
                    className="btn-upgrade-all"
                    onClick={() => handleSafeUpdate(false)}
                    disabled={isUpdating}
                    title="Upgrade all outdated packages across Python virtual environments"
                  >
                    {isUpdating ? "Upgrading..." : "Upgrade All"}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {report.version_drift.map((drift) => {
                const normalizedPkg = drift.package_name.toLowerCase().replace(/[-_.]+/g, "-");
                // Determine latest version from upgrades map or resolved plan
                const upgradeItem = drift.upgrades
                  ? Object.values(drift.upgrades).find((u) => u.latest)
                  : undefined;
                const latest =
                  upgradeItem?.latest ||
                  latestVersions[normalizedPkg] ||
                  latestVersions[drift.package_name] ||
                  "-";

                // Check if any installed version is lower than latest
                const isOutdated = Object.values(drift.versions).some((ver) => {
                  if (!ver || latest === "-") return false;
                  return ver !== latest;
                });

                return (
                  <tr key={drift.package_name} className="data-table-row">
                    <th scope="row" className="data-table-th-key">
                      {drift.package_name}
                    </th>
                    {projNames.map((pName) => (
                      <td key={pName} className="data-table-td-secondary">
                        {drift.versions[pName] || "-"}
                      </td>
                    ))}
                    <td className="data-table-td-secondary">{latest}</td>
                    <td className="data-table-cell">
                      <div className="row-gap-sm">
                        {isOutdated ? (
                          <span className="badge badge-orange">Upgrade</span>
                        ) : (
                          <span className={`badge ${drift.has_drift ? "badge-warning" : "badge-success"}`}>
                            {drift.has_drift ? "DRIFT" : "INSTALLED"}
                          </span>
                        )}
                        <HelpTooltip
                          content={
                            isOutdated
                              ? `Newer version available (${latest}). Click Upgrade to apply.`
                              : drift.has_drift
                              ? `Package ${drift.package_name} has mismatched versions across projects.`
                              : `Package ${drift.package_name} is up to date.`
                          }
                          position="left"
                        />
                      </div>
                    </td>
                    <td className="data-table-cell">
                      {isOutdated && (
                        <button
                          type="button"
                          className="btn-upgrade-row"
                          onClick={() => handleSafeUpdate(false, undefined, drift.package_name)}
                          disabled={isUpdating}
                          aria-label={`Upgrade ${drift.package_name} to version ${latest}`}
                        >
                          {updatingPackage === drift.package_name ? "Upgrading..." : "Upgrade"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
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
                    <th scope="col" className="data-table-cell">Latest Version</th>
                    <th scope="col" className="data-table-cell">Category</th>
                    <th scope="col" className="data-table-cell">Status</th>
                    <th scope="col" className="data-table-cell">
                      <button
                        type="button"
                        className="btn-upgrade-all"
                        onClick={() => handleSafeUpdate(false, guiProject.name)}
                        disabled={isUpdating}
                        title="Upgrade all outdated NPM packages in the Desktop GUI project"
                      >
                        {isUpdating ? "Upgrading..." : "Upgrade All"}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(guiProject.installed_packages).map(([pkg, ver]) => {
                    const latest = latestVersions[pkg] || latestVersions[pkg.toLowerCase()] || "-";
                    const isOutdated = latest !== "-" && latest !== ver;

                    return (
                      <tr key={pkg} className="data-table-row">
                        <th scope="row" className="data-table-th-key">
                          {pkg}
                        </th>
                        <td className="data-table-td-secondary">{ver}</td>
                        <td className="data-table-td-secondary">{latest}</td>
                        <td className="data-table-td-muted">
                          {pkg.startsWith("@types") || pkg.includes("eslint") || pkg === "typescript" || pkg === "vite" || pkg === "vitest" ? "Dev Dependency" : "Production Dependency"}
                        </td>
                        <td className="data-table-cell">
                          {isOutdated ? (
                            <span className="badge badge-orange">Upgrade</span>
                          ) : (
                            <span className="badge badge-success">INSTALLED</span>
                          )}
                        </td>
                        <td className="data-table-cell">
                          {isOutdated && (
                            <button
                              type="button"
                              className="btn-upgrade-row"
                              onClick={() => handleSafeUpdate(false, guiProject.name, pkg)}
                              disabled={isUpdating}
                              aria-label={`Upgrade ${pkg} to version ${latest}`}
                            >
                              {updatingPackage === pkg ? "Upgrading..." : "Upgrade"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
        title="Purge workspace caches?"
        message="Deep Cache Purge deletes __pycache__ folders, build caches and temporary artifacts across all workspace projects. They are rebuilt on the next run, which can be slow."
        confirmLabel="Purge caches"
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          setPendingAction(null);
          void handleDeepClean();
        }}
      />
    </div>
  );
};

export default HealthPanel;
