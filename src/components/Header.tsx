import React from "react";

interface HeaderProps {
  title: string;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title, onRefresh, isRefreshing }) => {
  return (
    <header className="top-header">
      <h2 className="header-title">{title}</h2>
      <div className="header-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? "Refreshing..." : "Refresh Audit"}
        </button>
      </div>
    </header>
  );
};
