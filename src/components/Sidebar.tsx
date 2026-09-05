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
    <aside className="sidebar">
      <div className="brand-header">
        <span className="brand-badge">PRO</span>
        <h1 className="brand-title">LemGendary AI</h1>
      </div>

      <nav className="nav-menu">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item ${currentTab === item.id ? "active" : ""}`}
            onClick={() => onSelectTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
};
