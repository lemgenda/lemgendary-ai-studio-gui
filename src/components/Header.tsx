import React from "react";
import { HelpTooltip } from "./HelpTooltip";

interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    <header className="top-header" role="banner">
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <h2 className="header-title">{title}</h2>
        <HelpTooltip content={`Active workspace view: ${title}. Use the sidebar to switch between compiler, training suite, and environment panels.`} />
      </div>
    </header>
  );
};

export default Header;
