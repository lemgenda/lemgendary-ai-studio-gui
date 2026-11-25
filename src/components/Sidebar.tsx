import React from "react";
import { HelpTooltip } from "./HelpTooltip";
import { ExternalLink } from "./common/ExternalLink";
import { MeshStatus } from "../api/types";
import { WORKSPACE_TABS } from "../navigation/workspaceTabs";
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
    docs: meshStatus.envManager,
    pipeline: meshStatus.envManager,
    health: meshStatus.envManager,
  };

  const navItems = WORKSPACE_TABS;

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
        <div className="brand-header-row">
          <img
            src={lemgendaIcon}
            alt="LemGendary Brand"
            className="brand-icon"
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
            <div key={item.id} className="nav-item-wrapper">
              <button
                id={`tab-${item.id}`}
                type="button"
                aria-current={isSelected ? "page" : undefined}
                aria-controls="main-content"
                className={`nav-item nav-item-grow ${isSelected ? "active" : ""}`}
                onClick={() => onSelectTab(item.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
              >
                <span
                  className={`status-indicator status-indicator-nav ${isOnline ? "status-online" : "status-offline"}`}
                  aria-label={isOnline ? "Sidecar online" : "Sidecar offline"}
                />
                {item.label}
              </button>
              <div className="nav-item-tooltip">
                <HelpTooltip content={item.tooltip} position="right" />
              </div>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-actions" role="region" aria-label="Tools and System Actions">
        {onOpenConfigEditor && (
          <div className="nav-item-wrapper">
            <button
              id="sidebar-btn-config"
              type="button"
              className="btn btn-secondary sidebar-action-btn nav-item-grow"
              onClick={onOpenConfigEditor}
              aria-label="Open Universal Configuration, Registry Editor & Secrets Vault Modal"
            >
              Config &amp; Secrets
            </button>
            <div className="nav-item-tooltip">
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
              className="btn btn-secondary sidebar-action-btn nav-item-grow"
              onClick={onOpenTestModal}
              aria-label="Open Test & Diagnostic Orchestrator modal"
            >
              Tests &amp; Diagnostics
            </button>
            <div className="nav-item-tooltip">
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
            className="sidebar-brand-logo"
          />
        </ExternalLink>
      </div>
    </aside>
  );
};

export default Sidebar;
