import React from "react";
import { HelpTooltip } from "../HelpTooltip";
import { ValidationBanner } from "../common/ValidationBanner";
import { ModelValidateIsolationResponse } from "../../api/types";

export interface VariationIsolationCheckerProps {
  modelKey: string;
  isolationReport: ModelValidateIsolationResponse | null;
  isValidatingIsolation: boolean;
  isGeneratingDocs: boolean;
  isStaging: boolean;
  isBusy: boolean;
  onGenerateDocs: () => void;
  onStageVariations: () => void;
  selectedVariation: "all" | "pytorch" | "onnx_fp32" | "onnx_fp16";
  onSelectVariation: (variation: "all" | "pytorch" | "onnx_fp32" | "onnx_fp16") => void;
  dryRun: boolean;
  onToggleDryRun: (dryRun: boolean) => void;
  uploadStatus: string | null;
}

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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {/* Variation 1: PyTorch */}
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-primary)" }}>PyTorch (.pt)</div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              {isolationReport?.variations?.pytorch?.files_found?.length
                ? isolationReport.variations.pytorch.files_found.join(", ")
                : "No .pt staged"}
            </div>
            <span
              className={`badge ${isolationReport?.variations?.pytorch?.is_valid && (isolationReport.variations.pytorch.files_found.length > 0) ? "badge-success" : "badge-secondary"}`}
              style={{ fontSize: "9px", marginTop: "4px", display: "inline-block" }}
            >
              {isolationReport?.variations?.pytorch?.is_valid && (isolationReport.variations.pytorch.files_found.length > 0) ? "ISOLATED" : "PENDING"}
            </span>
          </div>

          {/* Variation 2: ONNX FP32 */}
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-primary)" }}>ONNX FP32 (+Sidecar)</div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              {isolationReport?.variations?.onnx_fp32?.files_found?.length
                ? `${isolationReport.variations.onnx_fp32.files_found.length} file(s)`
                : "No FP32 staged"}
            </div>
            <span
              className={`badge ${isolationReport?.variations?.onnx_fp32?.is_valid && (isolationReport.variations.onnx_fp32.files_found.length > 0) ? "badge-success" : "badge-secondary"}`}
              style={{ fontSize: "9px", marginTop: "4px", display: "inline-block" }}
            >
              {isolationReport?.variations?.onnx_fp32?.is_valid && (isolationReport.variations.onnx_fp32.files_found.length > 0) ? "ISOLATED" : "PENDING"}
            </span>
          </div>

          {/* Variation 3: ONNX FP16 */}
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-primary)" }}>ONNX FP16 (Embedded)</div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              {isolationReport?.variations?.onnx_fp16?.files_found?.length
                ? isolationReport.variations.onnx_fp16.files_found.join(", ")
                : "No FP16 staged"}
            </div>
            <span
              className={`badge ${isolationReport?.variations?.onnx_fp16?.is_valid && (isolationReport.variations.onnx_fp16.files_found.length > 0) ? "badge-success" : "badge-secondary"}`}
              style={{ fontSize: "9px", marginTop: "4px", display: "inline-block" }}
            >
              {isolationReport?.variations?.onnx_fp16?.is_valid && (isolationReport.variations.onnx_fp16.files_found.length > 0) ? "ISOLATED" : "PENDING"}
            </span>
          </div>
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
            onChange={(e) => onSelectVariation(e.target.value as "all" | "pytorch" | "onnx_fp32" | "onnx_fp16")}
            style={{ width: "100%", padding: "6px 10px", fontSize: "12px" }}
          >
            <option value="all">All Variations (pytorch + onnx_fp32 + onnx_fp16)</option>
            <option value="pytorch">PyTorch Only (.pt)</option>
            <option value="onnx_fp32">ONNX FP32 Only (_FP32.onnx + .data)</option>
            <option value="onnx_fp16">ONNX FP16 Only (.onnx embedded)</option>
          </select>
        </div>

        <div className="form-group" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-primary)", cursor: "pointer", userSelect: "none", paddingBottom: "6px" }}>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => onToggleDryRun(e.target.checked)}
              style={{ cursor: "pointer", width: "16px", height: "16px" }}
            />
            <span>Dry-Run Validation Only</span>
            <HelpTooltip content="Runs StrictIsolationValidator and verifies upload payloads without communicating with Kaggle servers." />
          </label>
        </div>
      </div>

      {uploadStatus && (
        <ValidationBanner
          message={uploadStatus}
          style={{ marginTop: "6px", fontSize: "12px" }}
        />
      )}
    </div>
  );
};
