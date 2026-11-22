import React from "react";
import { HelpTooltip } from "./HelpTooltip";

interface HeaderProps {
  title: string;
  onOpenBugReport?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, onOpenBugReport }) => {
  return (
    <header className="top-header" role="banner">
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <h2 className="header-title">{title}</h2>
        <HelpTooltip content={`Active workspace view: ${title}. Use the sidebar to switch between compiler, training suite, and environment panels.`} />
      </div>

      {onOpenBugReport && (
        <div className="header-actions">
          <button
            id="header-btn-report-issue"
            type="button"
            className="header-action-icon-btn"
            onClick={onOpenBugReport}
            aria-label="Report Issue"
            title="Report Issue"
          >
            {/* Lucide bug icon (Iconify lucide:bug) */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="8" height="14" x="8" y="6" rx="4" />
              <path d="m19 7-3 2" />
              <path d="m5 7 3 2" />
              <path d="m19 19-3-2" />
              <path d="m5 19 3-2" />
              <path d="M20 13h-4" />
              <path d="M4 13h4" />
              <path d="m10 4 1 2" />
              <path d="m14 4-1 2" />
            </svg>
          </button>
          <HelpTooltip
            content="Report Issue: describe a problem, attach annotated screenshots and recent telemetry. The Environment Manager saves a ZIP report and opens your mail client to send it."
            position="bottom"
          />
        </div>
      )}
    </header>
  );
};

export default Header;
