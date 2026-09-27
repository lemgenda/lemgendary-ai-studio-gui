import React, { useState } from "react";

export interface HelpTooltipProps {
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  position = "top",
  className = "",
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span className={`help-tooltip-container ${className}`}>
      <button
        type="button"
        className="help-icon-btn"
        aria-label={`Help info: ${content}`}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        <span className="help-icon-glyph" aria-hidden="true">?</span>
      </button>

      {isVisible && (
        <span
          role="tooltip"
          className={`help-tooltip-bubble help-tooltip-${position}`}
        >
          {content}
        </span>
      )}
    </span>
  );
};

export default HelpTooltip;
