import React from "react";

export type BannerType = "info" | "success" | "warning" | "error";

export interface ValidationBannerProps {
  type?: BannerType;
  message?: React.ReactNode;
  children?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
  role?: "alert" | "status";
  autoDetectType?: boolean;
}

export const ValidationBanner: React.FC<ValidationBannerProps> = ({
  type,
  message,
  children,
  onDismiss,
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
  const bannerClass = `validation-banner banner-${computedType} ${
    onDismiss ? "validation-banner-dismissible" : ""
  } ${className}`.trim();

  return (
    <div className={bannerClass} role={computedRole}>
      <div className="validation-banner-body">
        <span>{content}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="btn-dismiss-icon"
          aria-label="Dismiss banner"
        >
          X
        </button>
      )}
    </div>
  );
};
