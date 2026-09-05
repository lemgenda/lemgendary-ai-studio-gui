import React from "react";

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const navItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "pipeline", label: "Clean Install Pipeline" },
    { id: "projects", label: "Project Environments" },
    { id: "health", label: "Health & Version Drift" },
    { id: "logs", label: "Real-time Telemetry" },
  ];

  return (
    <aside className="sidebar" aria-label="Application Sidebar">
      <div className="brand-header">
        <span className="brand-badge" aria-label="Professional Edition">PRO</span>
        <h1 className="brand-title">LemGendary AI</h1>
      </div>

      <nav className="nav-menu" role="tablist" aria-label="Workspace Sections">
        {navItems.map((item) => {
          const isSelected = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`panel-${item.id}`}
              className={`nav-item ${isSelected ? "active" : ""}`}
              onClick={() => onSelectTab(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
