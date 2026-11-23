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

  // Accent styling based on subsystem source and operation
  const isValidation = operation === "VALIDATION";
  const themeClass = isValidation
    ? "telemetry-theme-validation"
    : source === "compiler"
      ? "telemetry-theme-compiler"
      : source === "training"
        ? "telemetry-theme-training"
        : source === "pipeline"
          ? "telemetry-theme-pipeline"
          : "telemetry-theme-default";
  const clampedPct = Math.max(0, Math.min(100, percentage));
  const indicatorPct =
    clampedPct > 0 && clampedPct < 1 ? 1 : Math.round(clampedPct);

  return (
    <div
      className={`telemetry-progress-tracker ${themeClass} ${className}`}
      aria-label="Active Telemetry Progress Tracker"
    >
      {/* ─── LINE 1: NUMERIC DATA & METRICS (UNCONSTRAINED) ──────────────── */}
      <div className="telemetry-progress-header">
        {/* Left: Operation Title & Target */}
        <div className="telemetry-progress-title-group">
          <span className="telemetry-progress-dot" />
          <span className="telemetry-progress-op">
            {titlePrefix ? `${titlePrefix} ` : ""}
            {operation}
          </span>
          {target && (
            <code className="telemetry-progress-target" title={target}>
              {target}
            </code>
          )}
        </div>

        {/* Right: Unconstrained Numeric Data (Percentage, Size, Rate, ETA) */}
        <div className="telemetry-progress-metrics">
          {numericStats && (
            <span className="telemetry-progress-stats">
              [{numericStats}]
            </span>
          )}
          {rate && (!numericStats || !numericStats.includes(rate)) && (
            <span className="telemetry-progress-rate">
              {rate}
            </span>
          )}
          {eta && (!numericStats || !numericStats.includes(eta)) && (
            <span className="telemetry-progress-eta">
              ETA {eta}
            </span>
          )}
          <span className="telemetry-progress-pct">
            {isIndeterminate
              ? "IN-FLIGHT"
              : percentage > 0 && percentage < 1
              ? `${percentage.toFixed(2)}%`
              : `${percentage.toFixed(1)}%`}
          </span>
        </div>
      </div>

      {/* ─── LINE 2: VISUAL PROGRESS BAR ONLY ─────────────────────────────── */}
      <Progress.Root
        value={isIndeterminate ? null : percentage}
        max={100}
        aria-label={`${operation} Progress`}
        className="telemetry-progress-root"
      >
        <Progress.Indicator
          className={`telemetry-progress-indicator ${
            isIndeterminate ? "telemetry-progress-indicator-indeterminate" : ""
          }`}
          data-pct={isIndeterminate ? undefined : String(indicatorPct)}
        />
      </Progress.Root>
    </div>
  );
};

export default TelemetryProgressTracker;
