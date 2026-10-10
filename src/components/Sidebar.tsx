import React from "react";
import { HelpTooltip } from "./HelpTooltip";
import { MeshStatus } from "../api/types";
import lemgendaIcon from "../branding/lemgenda-icon.svg";
import lemgendaLogo from "../branding/lemgenda-logo.svg";

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenConfigEditor?: () => void;
  meshStatus: MeshStatus;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  meshStatus,
}) => {
  // Map each tab to the sidecar port it depends on for online/offline dot.
  const tabSidecarOnline: Record<string, boolean> = {
    dashboard: meshStatus.envManager,
    datasets: meshStatus.datasetCompiler,
    training: meshStatus.trainingSuite,
    pipeline: meshStatus.envManager,
    projects: meshStatus.envManager,
    health: meshStatus.envManager,
    logs: meshStatus.envManager,
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", tooltip: "Ecosystem overview: system hardware, quick clean install orchestrator, managed project environments, and live log stream." },
    { id: "datasets", label: "LemGendary Dataset Compiler Suite", tooltip: "Port 8100 sidecar: inspect manifold formats, sample counts, and trigger multi-threaded streaming WebDataset compilation." },
    { id: "training", label: "LemGendary Model Training Suite", tooltip: "Port 8200 sidecar: neural architecture cards, Sawtooth Governor VRAM telemetry, spatial ladder progression, and training dispatch." },
    { id: "pipeline", label: "Clean Install Pipeline", tooltip: "Deterministic 7-step environment recreation, toolchain audit, wheel cache purging, and bytecode verification." },
    { id: "projects", label: "Project Environments", tooltip: "Dedicated virtual environment status cards with package counts and individual project reconciliation controls." },
    { id: "health", label: "Health & Version Drift", tooltip: "Host toolchain prerequisites audit and cross-project package version comparison matrix." },
    { id: "logs", label: "Real-time Telemetry", tooltip: "High-throughput monospace console streaming real-time status and progress packets over WebSockets." },
  ];

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
          <HelpTooltip content="LemGendary AI Studio Desktop GUI v2.0. Unified client interface for dataset compilation, model training, and environment governance." />
        </div>
      </div>

      <div className="nav-menu" role="tablist" aria-orientation="vertical" aria-label="Workspace Sections">
        {navItems.map((item, index) => {
          const isSelected = currentTab === item.id;
          const isOnline = tabSidecarOnline[item.id] ?? false;
          return (
            <div key={item.id} className="nav-item-wrapper" style={{ display: "flex", alignItems: "center", position: "relative" }}>
              <button
                id={`tab-${item.id}`}
                type="button"
                role="tab"
                tabIndex={isSelected ? 0 : -1}
                aria-selected={isSelected}
                aria-controls={`panel-${item.id}`}
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
          );
        })}
      </div>

      <div className="sidebar-brand-footer" style={{ padding: "16px 8px 4px", borderTop: "1px solid var(--border-color)", marginTop: "auto", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <a
          href="https://www.lemgenda.hr/"
          target="_blank"
          rel="noopener noreferrer"
          className="sidebar-brand-link"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            padding: "4px 0",
            background: "transparent",
            textDecoration: "none",
          }}
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
        </a>
      </div>
    </aside>
  );
};

export default Sidebar;
