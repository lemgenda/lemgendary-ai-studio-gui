import React from "react";

export interface HoverPinPopoverProps {
  title: string;
  valueBadge: React.ReactNode;
  isPinned: boolean;
  onTogglePin: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}

export const HoverPinPopover: React.FC<HoverPinPopoverProps> = ({
  title,
  valueBadge,
  isPinned,
  onTogglePin,
  children,
  ariaLabel,
}) => {
  return (
    <div
      className={`hover-pin-container ${isPinned ? "is-pinned" : ""}`}
    >
      <button
        type="button"
        className="hover-pin-trigger"
        onClick={onTogglePin}
        aria-expanded={isPinned}
        aria-label={ariaLabel || `${title}. Click to pin open.`}
      >
        <div className="hover-pin-label-group">
          <span className="hover-pin-title">
            {title}
          </span>
          <span className="hover-pin-hint">
            {isPinned ? "(Pinned)" : "(Click to pin)"}
          </span>
        </div>
        <div>{valueBadge}</div>
      </button>

      <div className="hover-pin-content">
        {children}
      </div>
    </div>
  );
};
