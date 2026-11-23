import React from "react";
import { HelpTooltip } from "../HelpTooltip";
import { ValidationBanner } from "../common/ValidationBanner";
import { PresetOptions } from "./PresetOptions";
import { DatasetCompilationFormProps } from "./DatasetCompilationForm";
import { WEBDATASET_SHARD_EXTENSIONS } from "../../api/types";
import { findDatasetByManifold, getRecommendedPreset } from "./presetHelpers";

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
  | "compileLabelStrategy"
  | "onChangeCompileLabelStrategy"
  | "isCompiling"
  | "compileStatus"
  | "onCompile"
  | "datasetCompilerOnline"
>;

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
  compileLabelStrategy = "",
  onChangeCompileLabelStrategy,
  isCompiling,
  compileStatus,
  onCompile,
  datasetCompilerOnline,
}) => (
  <div>
    <div className="form-grid form-grid-standard">
      <div className="form-group">
        <label
          htmlFor="comp-select-manifold"
          className="form-field-label"
        >
          Target Manifold:
        </label>
        <select
          id="comp-select-manifold"
          className="editor-select form-control-sm"
          value={selectedManifold}
          onChange={(e) => {
            const nextKey = e.target.value;
            onSelectManifold(nextKey);
            const nextDs = findDatasetByManifold(datasets, nextKey);
            if (nextDs) {
              onSelectPreset(getRecommendedPreset(nextDs));
            }
          }}
          disabled={isCompiling}
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
          className="form-field-label"
        >
          Compilation Preset:
        </label>
        <select
          id="preset-select"
          className="editor-select form-control-sm"
          value={selectedPreset}
          onChange={(e) => onSelectPreset(e.target.value)}
          disabled={isCompiling}
        >
          <PresetOptions
            presets={presets}
            presetsError={presetsError}
            selectedPreset={selectedPreset}
          />
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="comp-input-max-gb" className="form-field-label">
          Max Size (GB):
        </label>
        <input
          id="comp-input-max-gb"
          type="number"
          min={0}
          step="any"
          className="editor-input form-control-sm"
          placeholder="Preset limit"
          value={compileMaxGb}
          onChange={(e) => onChangeCompileMaxGb(e.target.value)}
          disabled={isCompiling}
        />
      </div>

      <div className="form-group">
        <label htmlFor="comp-input-workers" className="form-field-label">
          Workers:
        </label>
        <input
          id="comp-input-workers"
          type="number"
          min={1}
          step={1}
          className="editor-input form-control-sm"
          placeholder="Server default"
          value={compileWorkers}
          onChange={(e) => onChangeCompileWorkers(e.target.value)}
          disabled={isCompiling}
        />
      </div>

      {(() => {
        const activeDataset = findDatasetByManifold(datasets, selectedManifold);
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
                <label htmlFor="comp-input-start-date" className="form-field-label">
                  Start Date:
                </label>
                <input
                  id="comp-input-start-date"
                  type="date"
                  className="editor-input form-control-sm"
                  value={compileStartDate}
                  onChange={(e) => onChangeCompileStartDate?.(e.target.value)}
                  disabled={isCompiling}
                />
              </div>
              <div className="form-group">
                <label htmlFor="comp-input-end-date" className="form-field-label">
                  End Date:
                </label>
                <input
                  id="comp-input-end-date"
                  type="date"
                  className="editor-input form-control-sm"
                  value={compileEndDate}
                  onChange={(e) => onChangeCompileEndDate?.(e.target.value)}
                  disabled={isCompiling}
                />
              </div>
            </>
          );
        }
        if (isLlm) {
          return (
            <div className="form-group">
              <label htmlFor="comp-yield-mode" className="form-field-label">
                Yield Strategy:
              </label>
              <input
                id="comp-yield-mode"
                type="text"
                readOnly
                className="editor-input form-control-sm form-control-readonly"
                value="Autonomous Source Analysis"
              />
            </div>
          );
        }
        return (
          <>
            {isDetection && (
              <div className="form-group">
                <label htmlFor="comp-select-label-strategy" className="form-field-label">
                  Label Strategy:
                </label>
                <select
                  id="comp-select-label-strategy"
                  className="editor-select form-control-sm"
                  value={compileLabelStrategy}
                  onChange={(e) => onChangeCompileLabelStrategy?.(e.target.value)}
                  disabled={isCompiling}
                >
                  <option value="">Manifest default</option>
                  <option value="yolov8">YOLOv8</option>
                  <option value="coco">COCO</option>
                  <option value="retinaface">RetinaFace</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="comp-select-shard-ext" className="form-field-label">
                Shard Extension:
              </label>
              <select
                id="comp-select-shard-ext"
                className="editor-select form-control-sm"
                value={compileShardExt}
                onChange={(e) => onChangeCompileShardExt(e.target.value)}
                disabled={isCompiling || !isWebDataset}
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

    <div className="row-gap-lg">
      <button
        id="comp-btn-compile"
        type="button"
        className="btn btn-primary btn-action-bold"
        onClick={onCompile}
        disabled={isCompiling || !datasetCompilerOnline}
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
        className="banner-space-top-sm banner-text-sm"
      />
    )}
  </div>
);
