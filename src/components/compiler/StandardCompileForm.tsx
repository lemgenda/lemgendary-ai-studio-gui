import React from "react";
import { HelpTooltip } from "../HelpTooltip";
import { ValidationBanner } from "../common/ValidationBanner";
import { PresetOptions } from "./PresetOptions";
import { DatasetCompilationFormProps } from "./DatasetCompilationForm";
import { WEBDATASET_SHARD_EXTENSIONS } from "../../api/types";

type StandardCompileFormProps = Pick<
  DatasetCompilationFormProps,
  | "datasets"
  | "presets"
  | "presetsError"
  | "selectedManifold"
  | "onSelectManifold"
  | "selectedPreset"
  | "onSelectPreset"
  | "compileMaxGb"
  | "onChangeCompileMaxGb"
  | "compileWorkers"
  | "onChangeCompileWorkers"
  | "compileShardExt"
  | "onChangeCompileShardExt"
  | "compileStartDate"
  | "onChangeCompileStartDate"
  | "compileEndDate"
  | "onChangeCompileEndDate"
  | "compileTargetSamples"
  | "onChangeCompileTargetSamples"
  | "compileLabelStrategy"
  | "onChangeCompileLabelStrategy"
  | "isCompiling"
  | "compileStatus"
  | "onCompile"
  | "datasetCompilerOnline"
>;

const FIELD_LABEL_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  fontWeight: 600,
  display: "block",
  marginBottom: "4px",
};

/** Standard mode: compile a registered manifold with a sidecar preset and optional size / worker overrides. */
export const StandardCompileForm: React.FC<StandardCompileFormProps> = ({
  datasets,
  presets,
  presetsError,
  selectedManifold,
  onSelectManifold,
  selectedPreset,
  onSelectPreset,
  compileMaxGb,
  onChangeCompileMaxGb,
  compileWorkers,
  onChangeCompileWorkers,
  compileShardExt,
  onChangeCompileShardExt,
  compileStartDate = "2019-01-01",
  onChangeCompileStartDate,
  compileEndDate = "",
  onChangeCompileEndDate,
  compileTargetSamples = "",
  onChangeCompileTargetSamples,
  compileLabelStrategy = "",
  onChangeCompileLabelStrategy,
  isCompiling,
  compileStatus,
  onCompile,
  datasetCompilerOnline,
}) => (
  <div>
    <div
      className="form-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "12px",
        marginBottom: "14px",
      }}
    >
      <div className="form-group">
        <label
          htmlFor="comp-select-manifold"
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            fontWeight: 600,
            display: "block",
            marginBottom: "4px",
          }}
        >
          Target Manifold:
        </label>
        <select
          id="comp-select-manifold"
          className="editor-select"
          value={selectedManifold}
          onChange={(e) => onSelectManifold(e.target.value)}
          disabled={isCompiling}
          style={{ fontSize: "12px", padding: "6px 8px" }}
        >
          {datasets.map((d) => (
            <option key={d.key} value={d.key}>
              {d.display_name} ({d.canonical_format || d.format})
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label
          htmlFor="preset-select"
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            fontWeight: 600,
            display: "block",
            marginBottom: "4px",
          }}
        >
          Compilation Preset:
        </label>
        <select
          id="preset-select"
          className="editor-select"
          value={selectedPreset}
          onChange={(e) => onSelectPreset(e.target.value)}
          disabled={isCompiling}
          style={{ fontSize: "12px", padding: "6px 8px" }}
        >
          <PresetOptions presets={presets} presetsError={presetsError} />
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="comp-input-max-gb" style={FIELD_LABEL_STYLE}>
          Max Size (GB):
        </label>
        <input
          id="comp-input-max-gb"
          type="number"
          min={0}
          step="any"
          className="editor-input"
          placeholder="Preset limit"
          value={compileMaxGb}
          onChange={(e) => onChangeCompileMaxGb(e.target.value)}
          disabled={isCompiling}
          style={{ fontSize: "12px", padding: "6px 8px" }}
        />
      </div>

      <div className="form-group">
        <label htmlFor="comp-input-workers" style={FIELD_LABEL_STYLE}>
          Workers:
        </label>
        <input
          id="comp-input-workers"
          type="number"
          min={1}
          step={1}
          className="editor-input"
          placeholder="Server default"
          value={compileWorkers}
          onChange={(e) => onChangeCompileWorkers(e.target.value)}
          disabled={isCompiling}
          style={{ fontSize: "12px", padding: "6px 8px" }}
        />
      </div>

      {(() => {
        const activeDataset = datasets.find((d) => d.key === selectedManifold);
        const activeTask = (activeDataset?.task || "").toLowerCase();
        const activeFormat = (activeDataset?.canonical_format || activeDataset?.format || "webdataset").toLowerCase();
        const isForex = activeTask === "forex" || activeFormat === "parquet";
        const isLlm = activeTask === "ai_helper" || activeFormat === "jsonl";
        const isDetection = activeTask === "detection" || activeTask === "pose";
        const isWebDataset = activeFormat === "webdataset";

        if (isForex) {
          return (
            <>
              <div className="form-group">
                <label htmlFor="comp-input-start-date" style={FIELD_LABEL_STYLE}>
                  Start Date:
                </label>
                <input
                  id="comp-input-start-date"
                  type="date"
                  className="editor-input"
                  value={compileStartDate}
                  onChange={(e) => onChangeCompileStartDate?.(e.target.value)}
                  disabled={isCompiling}
                  style={{ fontSize: "12px", padding: "6px 8px" }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="comp-input-end-date" style={FIELD_LABEL_STYLE}>
                  End Date:
                </label>
                <input
                  id="comp-input-end-date"
                  type="date"
                  className="editor-input"
                  value={compileEndDate}
                  onChange={(e) => onChangeCompileEndDate?.(e.target.value)}
                  disabled={isCompiling}
                  style={{ fontSize: "12px", padding: "6px 8px" }}
                />
              </div>
            </>
          );
        }
        if (isLlm) {
          return (
            <div className="form-group">
              <label htmlFor="comp-input-target-samples" style={FIELD_LABEL_STYLE}>
                Target Samples:
              </label>
              <input
                id="comp-input-target-samples"
                type="number"
                min={1}
                step={1}
                placeholder="525 (Manifest default)"
                className="editor-input"
                value={compileTargetSamples}
                onChange={(e) => onChangeCompileTargetSamples?.(e.target.value)}
                disabled={isCompiling}
                style={{ fontSize: "12px", padding: "6px 8px" }}
              />
            </div>
          );
        }
        return (
          <>
            {isDetection && (
              <div className="form-group">
                <label htmlFor="comp-select-label-strategy" style={FIELD_LABEL_STYLE}>
                  Label Strategy:
                </label>
                <select
                  id="comp-select-label-strategy"
                  className="editor-select"
                  value={compileLabelStrategy}
                  onChange={(e) => onChangeCompileLabelStrategy?.(e.target.value)}
                  disabled={isCompiling}
                  style={{ fontSize: "12px", padding: "6px 8px" }}
                >
                  <option value="">Manifest default</option>
                  <option value="yolov8">YOLOv8</option>
                  <option value="coco">COCO</option>
                  <option value="retinaface">RetinaFace</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="comp-select-shard-ext" style={FIELD_LABEL_STYLE}>
                Shard Extension:
              </label>
              <select
                id="comp-select-shard-ext"
                className="editor-select"
                value={compileShardExt}
                onChange={(e) => onChangeCompileShardExt(e.target.value)}
                disabled={isCompiling || !isWebDataset}
                style={{ fontSize: "12px", padding: "6px 8px" }}
              >
                <option value="">Compiler default</option>
                {WEBDATASET_SHARD_EXTENSIONS.map((ext) => (
                  <option key={ext} value={ext}>
                    .{ext}
                  </option>
                ))}
              </select>
            </div>
          </>
        );
      })()}
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <button
        id="comp-btn-compile"
        type="button"
        className="btn btn-primary"
        onClick={onCompile}
        disabled={isCompiling || !datasetCompilerOnline}
        style={{ fontSize: "12px", padding: "6px 14px", fontWeight: 600 }}
        aria-label={
          !datasetCompilerOnline
            ? "Compile unavailable: Dataset Compiler Sidecar offline"
            : "Start dataset manifold compilation"
        }
      >
        {isCompiling ? "Compiling Manifold..." : "Compile Manifold"}
      </button>
      <HelpTooltip content="Launch multi-threaded compilation with the selected presets.yaml profile (image format, quality, vetting and containers). Max Size, Workers and Shard Extension are optional overrides; leave them empty for the preset and sidecar defaults (shards default to .data)." />
    </div>

    {compileStatus && (
      <ValidationBanner
        message={compileStatus}
        style={{ marginTop: "12px", fontSize: "12px" }}
      />
    )}
  </div>
);
