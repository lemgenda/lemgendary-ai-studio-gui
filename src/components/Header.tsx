import React from "react";
import { HelpTooltip } from "./HelpTooltip";

interface HeaderProps {
  title: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenConfigEditor?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onRefresh,
  isRefreshing,
  onOpenConfigEditor,
}) => {
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
              aria-label="Open Universal Configuration & Registry Editor"
            >
              Config Editor
            </button>
            <HelpTooltip content="Open the Universal Dynamic Config & Registry Editor to inspect and safely edit ecosystem YAML and JSON manifests." />
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
