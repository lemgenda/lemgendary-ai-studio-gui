import React from "react";
import { HelpTooltip } from "./HelpTooltip";
import { fetchDocsStatus } from "../api/client";

interface HeaderProps {
  title: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenConfigEditor?: () => void;
  envManagerOnline: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onRefresh,
  isRefreshing,
  onOpenConfigEditor,
  envManagerOnline,
}) => {
  const handleOpenDocs = async () => {
    if (!envManagerOnline) {
      window.open("https://lemgenda.github.io/ai-training-whitepapers/index.html", "_blank");
      return;
    }
    try {
      const status = await fetchDocsStatus();
      if (status.offline_available) {
        window.open(status.local_url, "_blank");
      } else {
        window.open(status.online_url, "_blank");
      }
    } catch {
      window.open("https://lemgenda.github.io/ai-training-whitepapers/index.html", "_blank");
    }
  };
  return (
    <header className="top-header" role="banner">
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <h2 className="header-title">{title}</h2>
        <HelpTooltip content={`Active workspace view: ${title}. Use the sidebar to switch between compiler, training suite, and environment panels.`} />
      </div>

      <div className="header-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleOpenDocs}
            aria-label={envManagerOnline ? "Open local offline Documentation Hub" : "Open online Documentation Hub (offline sidecar unavailable)"}
          >
            {envManagerOnline ? "Docs Hub (Offline)" : "Docs (Web Fallback)"}
          </button>
          <HelpTooltip content={envManagerOnline ? "Open the complete local Documentation Hub whitepapers and manuals offline, served directly by the Environment Manager sidecar (zero internet connection required)." : "Environment Manager (Port 8000) is offline. Redirecting to the GitHub Pages web version of the Documentation Hub."} />

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.open("https://lemgenda.github.io/ai-training-whitepapers/index.html", "_blank")}
            aria-label="Open online Documentation Hub on GitHub Pages"
          >
            Docs (Web)
          </button>
          <HelpTooltip content="Visit the official LemGendary AI Documentation Hub hosted on GitHub Pages (https://lemgenda.github.io/ai-training-whitepapers/index.html)." />
        </div>

        {onOpenConfigEditor && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onOpenConfigEditor}
              aria-label="Open Universal Configuration & Registry Editor and Secrets Vault"
            >
              Config &amp; Secrets
            </button>
            <HelpTooltip content="Open the Universal Dynamic Config & Registry Editor and Secrets Vault to inspect manifests, hyperparameters, and manage API tokens (Kaggle mandatory, Google Drive, GitHub, MT5)." />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={isRefreshing ? "Refreshing audit in progress" : "Refresh audit and hardware data"}
            aria-busy={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh Audit"}
          </button>
          <HelpTooltip content="Query all active sidecars (ports 8000, 8100, 8200) to refresh hardware metrics, virtual environments, and pipeline states." />
        </div>
      </div>
    </header>
  );
};

export default Header;
