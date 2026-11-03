import React, { useEffect, useState } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { fetchDocsStatus, openExternalUrl } from "../api/client";

interface HeaderProps {
  title: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenConfigEditor?: () => void;
  onOpenTestModal?: () => void;
  onOpenBugReport?: () => void;
  envManagerOnline: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onRefresh,
  isRefreshing,
  onOpenConfigEditor,
  onOpenTestModal,
  onOpenBugReport,
  envManagerOnline,
}) => {
  // The offline hub is served by the Environment Manager at `local_url`.
  const [docsUrl, setDocsUrl] = useState<string | null>(null);
  const [docsOpenError, setDocsOpenError] = useState<string | null>(null);
  const [docsUnavailableReason, setDocsUnavailableReason] = useState<string>(
    "Checking the Environment Manager for the offline documentation hub..."
  );

  useEffect(() => {
    let cancelled = false;
    if (!envManagerOnline) {
      setDocsUrl(null);
      setDocsUnavailableReason("Unavailable: the Environment Manager (which serves the offline documentation hub) is offline.");
      return;
    }
    fetchDocsStatus()
      .then((status) => {
        if (cancelled) return;
        if (status.offline_available) {
          setDocsUrl(status.local_url);
        } else {
          setDocsUrl(null);
          setDocsUnavailableReason("Unavailable: the Environment Manager reports no local lemgendary-docs checkout.");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("Documentation hub status check failed:", err);
        setDocsUrl(null);
        setDocsUnavailableReason(`Unavailable: ${msg}`);
      });
    return () => {
      cancelled = true;
    };
  }, [envManagerOnline]);

  const handleOpenDocs = () => {
    if (!docsUrl) return;
    setDocsOpenError(null);
    openExternalUrl(docsUrl).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Opening the documentation hub failed:", err);
      setDocsOpenError(`Could not open the documentation hub: ${msg}`);
    });
  };

  return (
    <header className="top-header" role="banner">
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <h2 className="header-title">{title}</h2>
        <HelpTooltip content={`Active workspace view: ${title}. Use the sidebar to switch between compiler, training suite, and environment panels.`} />
      </div>

      <div className="header-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {onOpenConfigEditor && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onOpenConfigEditor}
              aria-label="Open Universal Configuration, Registry Editor & Secrets Vault Modal"
            >
              Config &amp; Secrets
            </button>
            <HelpTooltip content="Universal Configuration & Secrets Editor: Inspect and edit YAML manifests, dataset configs, model hyperparameters, and manage API keys & tokens." />
          </div>
        )}

        {onOpenBugReport && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              id="header-btn-report-issue"
              type="button"
              className="btn btn-secondary"
              onClick={onOpenBugReport}
              aria-label="Open the Report Issue form"
            >
              Report Issue
            </button>
            <HelpTooltip content="Report Issue: describe a problem, attach annotated screenshots and recent telemetry. The Environment Manager saves a ZIP report and opens your mail client to send it." />
          </div>
        )}

        {onOpenTestModal && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              id="header-btn-test-modal"
              type="button"
              className="btn btn-secondary"
              onClick={onOpenTestModal}
              aria-label="Open Test & Diagnostic Orchestrator modal"
            >
              Tests &amp; Diagnostics
            </button>
            <HelpTooltip content="Test & Diagnostic Orchestrator: dispatch the fleet 1-epoch smoke test, or run the Training Suite and Dataset Compiler unit test suites in-process on their sidecars." />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleOpenDocs}
            disabled={!docsUrl}
            title={docsUrl ? undefined : docsUnavailableReason}
            aria-label="Open local offline LemGendary AI Documentation Hub"
          >
            LemGendary AI Documentation Hub
          </button>
          <HelpTooltip
            content={
              docsUrl
                ? docsOpenError ?? "Open the complete local LemGendary AI Documentation Hub whitepapers and manuals offline, served by the Environment Manager with zero internet connection required."
                : docsUnavailableReason
            }
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            id="dash-btn-refresh-audit"
            type="button"
            className="btn btn-secondary"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={isRefreshing ? "Refreshing audit in progress" : "Refresh audit and hardware data"}
            aria-busy={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh Audit"}
          </button>
          <HelpTooltip content={`Query all active sidecars (ports 8000, 8100, 8200) to refresh hardware metrics, virtual environments, and pipeline states. Environment Manager status: ${envManagerOnline ? "Online" : "Offline"}.`} />
        </div>
      </div>
    </header>
  );
};

export default Header;
