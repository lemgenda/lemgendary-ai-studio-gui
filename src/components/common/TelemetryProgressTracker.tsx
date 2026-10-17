import React from "react";
import * as Progress from "@radix-ui/react-progress";
import { ParsedProgress } from "../../utils/progressParser";

export interface TelemetryProgressTrackerProps {
  progress: ParsedProgress | null;
  titlePrefix?: string;
  className?: string;
}

export const TelemetryProgressTracker: React.FC<TelemetryProgressTrackerProps> = ({
  progress,
  titlePrefix,
  className = "",
}) => {
  if (!progress) {
    return null;
  }

  const { operation, target, percentage, isIndeterminate, numericStats, rate, eta, source } = progress;

  // Accent styling based on subsystem source
  const sourceColor =
    source === "compiler"
      ? "var(--accent-cyan, #00f0ff)"
      : source === "training"
      ? "var(--accent-purple, #bf7af0)"
      : "var(--accent-emerald, #00ff88)";

  const gradient =
    source === "compiler"
      ? "linear-gradient(90deg, #00d2ff 0%, #00f0ff 60%, #00ff88 100%)"
      : source === "training"
      ? "linear-gradient(90deg, #8a2be2 0%, #bf7af0 60%, #00f0ff 100%)"
      : "linear-gradient(90deg, #00aa55 0%, #00ff88 60%, #00f0ff 100%)";

  return (
    <div
      className={`telemetry-progress-tracker ${className}`}
      style={{
        background: "rgba(10, 14, 23, 0.85)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: "8px",
        padding: "10px 14px",
        marginBottom: "12px",
        backdropFilter: "blur(12px)",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.35)",
      }}
      aria-label="Active Telemetry Progress Tracker"
    >
      {/* ─── LINE 1: NUMERIC DATA & METRICS (UNCONSTRAINED) ──────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "nowrap",
          gap: "12px",
          marginBottom: "8px",
          fontSize: "12px",
          lineHeight: 1.4,
        }}
      >
        {/* Left: Operation Title & Target */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flexShrink: 1 }}>
          <span
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: sourceColor,
              boxShadow: `0 0 8px ${sourceColor}`,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              color: sourceColor,
              flexShrink: 0,
            }}
          >
            {titlePrefix ? `${titlePrefix} ` : ""}
            {operation}
          </span>
          {target && (
            <code
              style={{
                color: "var(--text-primary, #ffffff)",
                fontSize: "11px",
                background: "rgba(255, 255, 255, 0.06)",
                padding: "1px 6px",
                borderRadius: "4px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={target}
            >
              {target}
            </code>
          )}
        </div>

        {/* Right: Unconstrained Numeric Data (Percentage, Size, Rate, ETA) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexShrink: 0,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "11px",
            color: "var(--text-muted, #94a3b8)",
          }}
        >
          {numericStats && (
            <span style={{ color: "var(--text-secondary, #cbd5e1)" }}>
              [{numericStats}]
            </span>
          )}
          {rate && (!numericStats || !numericStats.includes(rate)) && (
            <span style={{ color: "var(--accent-cyan, #00f0ff)" }}>
              {rate}
            </span>
          )}
          {eta && (!numericStats || !numericStats.includes(eta)) && (
            <span style={{ color: "var(--accent-yellow, #ffd166)" }}>
              ETA {eta}
            </span>
          )}
          <span
            style={{
              fontWeight: 700,
              fontSize: "13px",
              color: "#ffffff",
              background: "rgba(255, 255, 255, 0.1)",
              padding: "2px 8px",
              borderRadius: "4px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              minWidth: "52px",
              textAlign: "right",
            }}
          >
            {isIndeterminate
              ? "IN-FLIGHT"
              : percentage > 0 && percentage < 1
              ? `${percentage.toFixed(2)}%`
              : `${percentage.toFixed(1)}%`}
          </span>
        </div>
      </div>

      {/* ─── LINE 2: VISUAL PROGRESS BAR ONLY ─────────────────────────────── */}
      <style>{`
        @keyframes telemetry-indeterminate-sweep {
          0% { transform: translateX(-100%); width: 40%; }
          50% { transform: translateX(50%); width: 60%; }
          100% { transform: translateX(200%); width: 40%; }
        }
      `}</style>
      <Progress.Root
        value={isIndeterminate ? null : percentage}
        max={100}
        aria-label={`${operation} Progress`}
        style={{
          position: "relative",
          overflow: "hidden",
          background: "rgba(255, 255, 255, 0.08)",
          borderRadius: "9999px",
          width: "100%",
          height: "7px",
          transform: "translateZ(0)",
        }}
      >
        <Progress.Indicator
          style={{
            background: gradient,
            width: isIndeterminate ? "50%" : "100%",
            height: "100%",
            borderRadius: "9999px",
            boxShadow: `0 0 12px ${sourceColor}`,
            transition: isIndeterminate ? "none" : "transform 250ms cubic-bezier(0.4, 0, 0.2, 1)",
            animation: isIndeterminate ? "telemetry-indeterminate-sweep 1.8s infinite ease-in-out" : "none",
            transform: isIndeterminate
              ? undefined
              : `translateX(-${100 - percentage}%)`,
          }}
        />
      </Progress.Root>
    </div>
  );
};

export default TelemetryProgressTracker;
