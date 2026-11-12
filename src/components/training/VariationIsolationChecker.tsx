import React from "react";
import { HelpTooltip } from "../HelpTooltip";
import { ValidationBanner } from "../common/ValidationBanner";
import { ModelValidateIsolationResponse, VARIATION_KEYS, VariationChoice, VariationKey } from "../../api/types";
import { PushStatusMessage } from "./kagglePushSummary";
import { VARIATION_CHOICES, VARIATION_DISPLAY, toVariationChoice } from "./kaggleVariations";

export interface VariationIsolationCheckerProps {
  modelKey: string;
  isolationReport: ModelValidateIsolationResponse | null;
  isValidatingIsolation: boolean;
  isGeneratingDocs: boolean;
  isStaging: boolean;
  isBusy: boolean;
  onGenerateDocs: () => void;
  onStageVariations: () => void;
  selectedVariation: VariationChoice;
  onSelectVariation: (variation: VariationChoice) => void;
  dryRun: boolean;
  onToggleDryRun: (dryRun: boolean) => void;
  uploadStatus: PushStatusMessage | null;
}

/** One staged instance of the isolation report (keyed by `VariationKey`). */
const VariationCard: React.FC<{ variation: VariationKey; report: ModelValidateIsolationResponse | null }> = ({ variation, report }) => {
  const detail = report?.variations?.[variation];
  const files = detail?.files_found ?? [];
  const isolated = Boolean(detail?.is_valid && files.length > 0);
  const display = VARIATION_DISPLAY[variation];
  return (
    <div
      data-variation={variation}
      style={{ background: "rgba(0,0,0,0.2)", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-color)" }}
    >
      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-primary)" }}>{display.label}</div>
      <div style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{variation}</div>
      <div style={{ fontSize: "10px", color: "var(--text-muted)" }} title={files.join(", ")}>
        {files.length ? `${files.length} file(s)` : `Nothing staged (${display.payload})`}
      </div>
      {detail?.errors?.length ? (
        <div style={{ fontSize: "10px", color: "#f87171" }}>{detail.errors.join("; ")}</div>
      ) : null}
      <span
        className={`badge ${isolated ? "badge-success" : "badge-secondary"}`}
        style={{ fontSize: "9px", marginTop: "4px", display: "inline-block" }}
      >
        {isolated ? "ISOLATED" : "PENDING"}
      </span>
    </div>
  );
};

export const VariationIsolationChecker: React.FC<VariationIsolationCheckerProps> = ({
  modelKey,
  isolationReport,
  isValidatingIsolation,
  isGeneratingDocs,
  isStaging,
  isBusy,
  onGenerateDocs,
  onStageVariations,
  selectedVariation,
  onSelectVariation,
  dryRun,
  onToggleDryRun,
  uploadStatus,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Header and Action Triggers */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>
          Distribution Staging Controls:
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onGenerateDocs}
            disabled={isGeneratingDocs || isBusy}
            style={{ fontSize: "11px", padding: "4px 8px" }}
            title={`Regenerates README.md and model-metadata.json for ${modelKey}`}
          >
            {isGeneratingDocs ? "Regenerating..." : "Regen Docs & Meta"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onStageVariations}
            disabled={isStaging || isBusy}
            style={{ fontSize: "11px", padding: "4px 8px" }}
            title={`Copies model binaries from root into dist/kaggle/ variation directories for ${modelKey}`}
          >
            {isStaging ? "Staging..." : "Stage Variations"}
          </button>
        </div>
      </div>

      {/* Isolation Status Checklist */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>
          Binary Isolation Status (dist/kaggle/):
          {isValidatingIsolation && (
            <span style={{ color: "#38bdf8", textTransform: "none", marginLeft: "6px" }}>
              (Verifying...)
            </span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {VARIATION_KEYS.map((key) => (
            <VariationCard key={key} variation={key} report={isolationReport} />
          ))}
        </div>
      </div>

      {/* Upload Controls */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div className="form-group">
          <label htmlFor="variation-select" style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px", display: "block" }}>
            Framework Variation to Push:
          </label>
          <select
            id="variation-select"
            className="editor-select"
            value={selectedVariation}
            onChange={(e) => onSelectVariation(toVariationChoice(e.target.value))}
            style={{ width: "100%", padding: "6px 10px", fontSize: "12px" }}
          >
            {VARIATION_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingBottom: "6px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-primary)", cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => onToggleDryRun(e.target.checked)}
                style={{ cursor: "pointer", width: "16px", height: "16px" }}
              />
              <span>Dry-Run Validation Only</span>
            </label>
            <HelpTooltip content="Runs StrictIsolationValidator and verifies upload payloads without communicating with Kaggle servers." />
          </div>
        </div>
      </div>

      {uploadStatus && (
        <ValidationBanner
          type={uploadStatus.type}
          message={uploadStatus.message}
          style={{ marginTop: "6px", fontSize: "12px" }}
        />
      )}
    </div>
  );
};
