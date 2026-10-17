import React from "react";

export interface HoverPinPopoverProps {
  title: string;
  valueBadge: React.ReactNode;
  isPinned: boolean;
  onTogglePin: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  style?: React.CSSProperties;
}

export const HoverPinPopover: React.FC<HoverPinPopoverProps> = ({
  title,
  valueBadge,
  isPinned,
  onTogglePin,
  children,
  ariaLabel,
  style,
}) => {
  return (
    <div
      className={`hover-pin-container ${isPinned ? "is-pinned" : ""}`}
      style={style}
    >
      <button
        type="button"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
          color: "inherit",
          font: "inherit",
        }}
        onClick={onTogglePin}
        aria-expanded={isPinned}
        aria-label={ariaLabel || `${title}. Click to pin open.`}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>
            {title}
          </span>
          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
            {isPinned ? "(Pinned)" : "(Click to pin)"}
          </span>
        </div>
        <div>{valueBadge}</div>
      </button>

      <div
        className="hover-pin-content"
        style={{
          marginTop: "10px",
          paddingTop: "8px",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        {children}
      </div>
    </div>
  );
};
