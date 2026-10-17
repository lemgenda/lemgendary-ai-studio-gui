import React from "react";

export type BannerType = "info" | "success" | "warning" | "error";

export interface ValidationBannerProps {
  type?: BannerType;
  message?: React.ReactNode;
  children?: React.ReactNode;
  onDismiss?: () => void;
  style?: React.CSSProperties;
  className?: string;
  role?: "alert" | "status";
  autoDetectType?: boolean;
}

export const ValidationBanner: React.FC<ValidationBannerProps> = ({
  type,
  message,
  children,
  onDismiss,
  style,
  className = "",
  role,
  autoDetectType = true,
}) => {
  const content = message ?? children;
  if (!content) return null;

  let computedType: BannerType = type || "info";

  if (!type && autoDetectType && typeof content === "string") {
    const lower = content.toLowerCase();
    if (lower.includes("fail") || lower.includes("error") || lower.includes("invalid") || lower.includes("malformed")) {
      computedType = "error";
    } else if (lower.includes("success") || lower.includes("saved") || lower.includes("passed") || lower.includes("staged") || lower.includes("valid")) {
      computedType = "success";
    } else if (lower.includes("warn") || lower.includes("drift")) {
      computedType = "warning";
    } else {
      computedType = "info";
    }
  }

  const computedRole = role ?? (computedType === "error" || computedType === "warning" ? "alert" : "status");
  const bannerClass = `validation-banner banner-${computedType} ${className}`.trim();

  return (
    <div
      className={bannerClass}
      style={{
        display: onDismiss ? "flex" : undefined,
        alignItems: onDismiss ? "center" : undefined,
        justifyContent: onDismiss ? "space-between" : undefined,
        ...style,
      }}
      role={computedRole}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
        <span>{content}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: "transparent",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            fontWeight: 700,
            padding: "0 4px",
            fontSize: "12px",
            lineHeight: 1,
          }}
          aria-label="Dismiss banner"
        >
          X
        </button>
      )}
    </div>
  );
};
