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
      className="variation-card"
    >
      <div className="variation-card-title">{display.label}</div>
      <div className="variation-card-key">{variation}</div>
      <div className="variation-card-files" title={files.join(", ")}>
        {files.length ? `${files.length} file(s)` : `Nothing staged (${display.payload})`}
      </div>
      {detail?.errors?.length ? (
        <div className="variation-card-error">{detail.errors.join("; ")}</div>
      ) : null}
      <span
        className={`badge badge-xs-block ${isolated ? "badge-success" : "badge-secondary"}`}
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
    <div className="isolation-wrapper">
      {/* Header and Action Triggers */}
      <div className="row-between">
        <span className="isolation-controls-title">
          Distribution Staging Controls:
        </span>
        <div className="row-gap-md">
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={onGenerateDocs}
            disabled={isGeneratingDocs || isBusy}
            title={`Regenerates README.md and model-metadata.json for ${modelKey}`}
          >
            {isGeneratingDocs ? "Regenerating..." : "Regen Docs & Meta"}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={onStageVariations}
            disabled={isStaging || isBusy}
            title={`Copies model binaries from root into dist/kaggle/ variation directories for ${modelKey}`}
          >
            {isStaging ? "Staging..." : "Stage Variations"}
          </button>
        </div>
      </div>

      {/* Isolation Status Checklist */}
      <div className="stack-xs">
        <div className="isolation-status-heading">
          Binary Isolation Status (dist/kaggle/):
          {isValidatingIsolation && (
            <span className="isolation-verifying">
              (Verifying...)
            </span>
          )}
        </div>

        <div className="isolation-grid">
          {VARIATION_KEYS.map((key) => (
            <VariationCard key={key} variation={key} report={isolationReport} />
          ))}
        </div>
      </div>

      {/* Upload Controls */}
      <div className="isolation-controls-grid">
        <div className="form-group">
          <label htmlFor="variation-select" className="form-field-label-secondary">
            Framework Variation to Push:
          </label>
          <select
            id="variation-select"
            className="editor-select form-control-wide-md"
            value={selectedVariation}
            onChange={(e) => onSelectVariation(toVariationChoice(e.target.value))}
          >
            {VARIATION_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group form-checkbox-field">
          <div className="form-checkbox-inner-sm">
            <label className="checkbox-label">
              <input
                type="checkbox"
                className="checkbox-input-lg"
                checked={dryRun}
                onChange={(e) => onToggleDryRun(e.target.checked)}
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
          className="banner-space-top-2xs banner-text-sm"
        />
      )}
    </div>
  );
};
