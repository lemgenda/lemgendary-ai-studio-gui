import React, { useEffect, useState } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { ExternalLink } from "./common/ExternalLink";
import { MeshStatus } from "../api/types";
import { WORKSPACE_TABS } from "../navigation/workspaceTabs";
import { fetchDocsStatus, openExternalUrl } from "../api/client";
import { logger } from "../utils/logger";
import lemgendaIcon from "../branding/lemgenda-icon.svg";
import lemgendaLogo from "../branding/lemgenda-logo.svg";

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  meshStatus: MeshStatus;
  onOpenConfigEditor?: () => void;
  onOpenTestModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  meshStatus,
  onOpenConfigEditor,
  onOpenTestModal,
}) => {
  // Map each tab to the sidecar port it depends on for online/offline dot.
  const tabSidecarOnline: Record<string, boolean> = {
    dashboard: meshStatus.envManager,
    datasets: meshStatus.datasetCompiler,
    training: meshStatus.trainingSuite,
    pipeline: meshStatus.envManager,
    health: meshStatus.envManager,
  };

  const navItems = WORKSPACE_TABS;

  // The offline hub is served by the Environment Manager at `local_url`.
  const [docsUrl, setDocsUrl] = useState<string | null>(null);
  const [docsOpenError, setDocsOpenError] = useState<string | null>(null);
  const [docsUnavailableReason, setDocsUnavailableReason] = useState<string>(
    "Checking the Environment Manager for the offline documentation hub..."
  );

  useEffect(() => {
    let cancelled = false;
    if (!meshStatus.envManager) {
      setDocsUrl(null);
      setDocsUnavailableReason(
        "Unavailable: the Environment Manager (which serves the offline documentation hub) is offline."
      );
      return;
    }
    fetchDocsStatus()
      .then((status) => {
        if (cancelled) return;
        if (status.offline_available) {
          setDocsUrl(status.local_url);
        } else {
          setDocsUrl(null);
          setDocsUnavailableReason(
            "Unavailable: the Environment Manager reports no local lemgendary-docs checkout."
          );
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn("Documentation hub status check failed", err);
        setDocsUrl(null);
        setDocsUnavailableReason(`Unavailable: ${msg}`);
      });
    return () => {
      cancelled = true;
    };
  }, [meshStatus.envManager]);

  const handleOpenDocs = () => {
    if (!docsUrl) return;
    setDocsOpenError(null);
    openExternalUrl(docsUrl).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Opening the documentation hub failed", err);
      setDocsOpenError(`Could not open the documentation hub: ${msg}`);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % navItems.length;
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + navItems.length) % navItems.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = navItems.length - 1;
    }

    if (nextIndex >= 0) {
      const targetItem = navItems[nextIndex];
      onSelectTab(targetItem.id);
      const targetElem = document.getElementById(`tab-${targetItem.id}`);
      if (targetElem) {
        targetElem.focus();
      }
    }
  };

  return (
    <aside className="sidebar" aria-label="Application Sidebar">
      <div className="brand-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img
            src={lemgendaIcon}
            alt="LemGendary Brand"
            style={{ width: "24px", height: "24px", objectFit: "contain", flexShrink: 0 }}
          />
          <h1 className="brand-title">LemGendary AI</h1>
          <HelpTooltip
            position="bottom"
            content="LemGendary AI Studio Desktop GUI v2.0. Unified client interface for dataset compilation, model training, and environment governance."
          />
        </div>
      </div>

      {/* Navigation, not a tablist: each entry has a help button next to it, which a tablist may not contain. */}
      <nav className="nav-menu" aria-label="Workspace Sections">
        {navItems.map((item, index) => {
          const isSelected = currentTab === item.id;
          const isOnline = tabSidecarOnline[item.id] ?? false;
          return (
            <React.Fragment key={item.id}>
              <div className="nav-item-wrapper">
                <button
                  id={`tab-${item.id}`}
                  type="button"
                  aria-current={isSelected ? "page" : undefined}
                  aria-controls="main-content"
                  className={`nav-item ${isSelected ? "active" : ""}`}
                  style={{ flex: 1, paddingRight: "36px" }}
                  onClick={() => onSelectTab(item.id)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                >
                  <span
                    className={`status-indicator ${isOnline ? "status-online" : "status-offline"}`}
                    aria-label={isOnline ? "Sidecar online" : "Sidecar offline"}
                    style={{ display: "inline-block", marginRight: "8px", flexShrink: 0 }}
                  />
                  {item.label}
                </button>
                <div style={{ position: "absolute", right: "10px", zIndex: 2 }}>
                  <HelpTooltip content={item.tooltip} position="right" />
                </div>
              </div>

              {/* Documentation Hub placed directly below Training Suite and above Clean Install Pipeline */}
              {item.id === "training" && (
                <div className="nav-item-wrapper">
                  <button
                    id="sidebar-btn-docs-hub"
                    type="button"
                    className="nav-item"
                    style={{ flex: 1, paddingRight: "36px" }}
                    onClick={handleOpenDocs}
                    disabled={!docsUrl}
                    title={docsUrl ? undefined : docsUnavailableReason}
                    aria-label="Open local offline LemGendary AI Documentation Hub"
                  >
                    <span
                      className={`status-indicator ${docsUrl ? "status-online" : "status-offline"}`}
                      aria-label={docsUrl ? "Documentation Hub online" : "Documentation Hub offline"}
                      style={{ display: "inline-block", marginRight: "8px", flexShrink: 0 }}
                    />
                    LemGendary AI Documentation Hub
                  </button>
                  <div style={{ position: "absolute", right: "10px", zIndex: 2 }}>
                    <HelpTooltip
                      content={
                        docsUrl
                          ? docsOpenError ?? "Open the complete local LemGendary AI Documentation Hub whitepapers and manuals offline, served by the Environment Manager with zero internet connection required."
                          : docsUnavailableReason
                      }
                      position="right"
                    />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      <div className="sidebar-actions" role="region" aria-label="Tools and System Actions">
        {onOpenConfigEditor && (
          <div className="nav-item-wrapper">
            <button
              id="sidebar-btn-config"
              type="button"
              className="btn btn-secondary sidebar-action-btn"
              style={{ flex: 1, paddingRight: "36px" }}
              onClick={onOpenConfigEditor}
              aria-label="Open Universal Configuration, Registry Editor & Secrets Vault Modal"
            >
              Config &amp; Secrets
            </button>
            <div style={{ position: "absolute", right: "10px", zIndex: 2 }}>
              <HelpTooltip
                content="Universal Configuration & Secrets Editor: Inspect and edit YAML manifests, dataset configs, model hyperparameters, and manage API keys & tokens."
                position="right"
              />
            </div>
          </div>
        )}

        {onOpenTestModal && (
          <div className="nav-item-wrapper">
            <button
              id="header-btn-test-modal"
              type="button"
              className="btn btn-secondary sidebar-action-btn"
              style={{ flex: 1, paddingRight: "36px" }}
              onClick={onOpenTestModal}
              aria-label="Open Test & Diagnostic Orchestrator modal"
            >
              Tests &amp; Diagnostics
            </button>
            <div style={{ position: "absolute", right: "10px", zIndex: 2 }}>
              <HelpTooltip
                content="Test & Diagnostic Orchestrator: dispatch the fleet 1-epoch smoke test, or run the Training Suite and Dataset Compiler unit test suites in-process on their sidecars."
                position="right"
              />
            </div>
          </div>
        )}
      </div>

      <div className="sidebar-brand-footer">
        <ExternalLink
          href="https://www.lemgenda.hr/"
          className="sidebar-brand-link"
          aria-label="Visit LemGenda Official Website (https://www.lemgenda.hr/)"
        >
          <img
            src={lemgendaLogo}
            alt="LemGenda"
            style={{
              width: "100%",
              maxWidth: "160px",
              height: "26px",
              objectFit: "contain",
              filter: "brightness(1.15)",
              transition: "transform 0.2s ease, opacity 0.2s ease",
            }}
          />
        </ExternalLink>
      </div>
    </aside>
  );
};

export default Sidebar;
