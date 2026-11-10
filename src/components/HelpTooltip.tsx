import React, { useRef, useState } from "react";

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
  const [resolvedPosition, setResolvedPosition] = useState<"top" | "bottom" | "left" | "right">(position);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const handleShow = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Auto-flip from top to bottom if too close to the top of the viewport
      if (position === "top" && rect.top < 80) {
        setResolvedPosition("bottom");
      } else if (position === "bottom" && rect.bottom > window.innerHeight - 80) {
        setResolvedPosition("top");
      } else {
        setResolvedPosition(position);
      }
    }
    setIsVisible(true);
  };

  const handleHide = () => {
    setIsVisible(false);
  };

  return (
    <span className={`help-tooltip-container ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="help-icon-btn"
        aria-label={`Help info: ${content}`}
        onMouseEnter={handleShow}
        onMouseLeave={handleHide}
        onFocus={handleShow}
        onBlur={handleHide}
      >
        <span className="help-icon-glyph" aria-hidden="true">?</span>
      </button>

      {isVisible && (
        <span
          role="tooltip"
          className={`help-tooltip-bubble help-tooltip-${resolvedPosition}`}
        >
          {content}
        </span>
      )}
    </span>
  );
};

export default HelpTooltip;
