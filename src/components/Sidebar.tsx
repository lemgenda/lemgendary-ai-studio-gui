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
        <span className="brand-badge" aria-label="Professional Edition">PRO</span>
        <h1 className="brand-title">LemGendary AI</h1>
      </div>

      <div className="nav-menu" role="tablist" aria-orientation="vertical" aria-label="Workspace Sections">
        {navItems.map((item, index) => {
          const isSelected = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`tab-${item.id}`}
              type="button"
              role="tab"
              tabIndex={isSelected ? 0 : -1}
              aria-selected={isSelected}
              aria-controls={`panel-${item.id}`}
              className={`nav-item ${isSelected ? "active" : ""}`}
              onClick={() => onSelectTab(item.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
};
