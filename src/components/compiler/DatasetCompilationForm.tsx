import React from "react";
import { HelpTooltip } from "../HelpTooltip";
import { KaggleIngestionBar } from "./KaggleIngestionBar";
import { StandardCompileForm } from "./StandardCompileForm";
import { CustomCompileForm } from "./CustomCompileForm";
import { ValidationBanner } from "../common/ValidationBanner";
import { CompilerPreset, DatasetItem } from "../../api/types";
import { servicePort } from "../../api/config";
import { ecosystemService } from "../../api/ecosystem";

export interface DatasetCompilationFormProps {
  datasets: DatasetItem[];
  /** Presets from the sidecar's presets.yaml; empty while it is offline. */
  presets: CompilerPreset[];
  /** Why presets could not be loaded, or null. */
  presetsError: string | null;
  selectedManifold: string;
  onSelectManifold: (key: string) => void;
  selectedPreset: string;
  onSelectPreset: (presetId: string) => void;
  /** Max size override in GB (`max_gb`); empty = the preset's own limit. */
  compileMaxGb: string;
  onChangeCompileMaxGb: (value: string) => void;
  /** Parallel worker processes (`workers`); empty = the sidecar default. */
  compileWorkers: string;
  onChangeCompileWorkers: (value: string) => void;
  /** WebDataset shard extension (`shard_ext`); empty = the compiler default. */
  compileShardExt: string;
  onChangeCompileShardExt: (value: string) => void;
  compileStartDate?: string;
  onChangeCompileStartDate?: (value: string) => void;
  compileEndDate?: string;
  onChangeCompileEndDate?: (value: string) => void;
  compileTargetSamples?: string;
  onChangeCompileTargetSamples?: (value: string) => void;
  compileLabelStrategy?: string;
  onChangeCompileLabelStrategy?: (value: string) => void;
  isCompiling: boolean;
  compileStatus: string | null;
  onDismissCompileStatus?: () => void;
  onCompile: () => void;
  compileMode: "standard" | "custom";
  onChangeCompileMode: (mode: "standard" | "custom") => void;
  customName: string;
  onChangeCustomName: (name: string) => void;
  customTask: string;
  onChangeCustomTask: (task: string) => void;
  customPreset: string;
  onChangeCustomPreset: (preset: string) => void;
  customCanonicalFormat: "webdataset" | "parquet" | "mds" | "litdata";
  onChangeCustomCanonicalFormat: (format: "webdataset" | "parquet" | "mds" | "litdata") => void;
  customShardSize: number;
  onChangeCustomShardSize: (size: number) => void;
  customSourcesText: string;
  onChangeCustomSourcesText: (text: string) => void;
  customPurgeLoose: boolean;
  onToggleCustomPurgeLoose: (purge: boolean) => void;
  isCustomCompiling: boolean;
  customCompileStatus: string | null;
  onDismissCustomCompileStatus?: () => void;
  onCustomCompile: () => void;
  customKaggleRef: string;
  onChangeCustomKaggleRef: (ref: string) => void;
  downloadTargetFolder: string;
  onChangeDownloadTargetFolder: (folder: string) => void;
  downloadForce: boolean;
  onToggleDownloadForce: (force: boolean) => void;
  isDownloadingKaggle: boolean;
  downloadStatus: string | null;
  onDismissDownloadStatus?: () => void;
  onDownloadKaggleDirect: () => void;
  datasetCompilerOnline: boolean;
}

/** Form state and handlers owned by `useCompilationForm`; the panel supplies the catalog props. */
export type CompilationFormControls = Omit<
  DatasetCompilationFormProps,
  "datasets" | "presets" | "selectedManifold" | "onSelectManifold" | "presetsError" | "datasetCompilerOnline"
>;

export const DatasetCompilationForm: React.FC<DatasetCompilationFormProps> = ({
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
  compileStartDate,
  onChangeCompileStartDate,
  compileEndDate,
  onChangeCompileEndDate,
  compileLabelStrategy,
  onChangeCompileLabelStrategy,
  isCompiling,
  compileStatus,
  onDismissCompileStatus,
  onCompile,
  compileMode,
  onChangeCompileMode,
  customName,
  onChangeCustomName,
  customTask,
  onChangeCustomTask,
  customPreset,
  onChangeCustomPreset,
  customCanonicalFormat,
  onChangeCustomCanonicalFormat,
  customShardSize,
  onChangeCustomShardSize,
  customSourcesText,
  onChangeCustomSourcesText,
  customPurgeLoose,
  onToggleCustomPurgeLoose,
  isCustomCompiling,
  customCompileStatus,
  onDismissCustomCompileStatus,
  onCustomCompile,
  customKaggleRef,
  onChangeCustomKaggleRef,
  downloadTargetFolder,
  onChangeDownloadTargetFolder,
  downloadForce,
  onToggleDownloadForce,
  isDownloadingKaggle,
  downloadStatus,
  onDismissDownloadStatus,
  onDownloadKaggleDirect,
  datasetCompilerOnline,
}) => {
  return (
    <div className="compiler-form-stack">
      {/* ── Direct Kaggle Cloud Ingestion Bar ── */}
      <KaggleIngestionBar
        customKaggleRef={customKaggleRef}
        onChangeCustomKaggleRef={onChangeCustomKaggleRef}
        downloadTargetFolder={downloadTargetFolder}
        onChangeDownloadTargetFolder={onChangeDownloadTargetFolder}
        downloadForce={downloadForce}
        onToggleDownloadForce={onToggleDownloadForce}
        isDownloadingKaggle={isDownloadingKaggle}
        downloadStatus={downloadStatus}
        onDismissDownloadStatus={onDismissDownloadStatus}
        onDownloadKaggleDirect={onDownloadKaggleDirect}
        datasetCompilerOnline={datasetCompilerOnline}
      />

      {/* ── Compilation Mode Form (Standard vs Custom) ── */}
      <div className="card compile-engine-card">
        <div className="compile-engine-header">
          <div className="row-gap-md">
            <h4 className="card-section-title">
              Dataset Compilation Engine
            </h4>
            <HelpTooltip content="Compile raw multi-source imagery into production WebDataset (.data) or MosaicML Streaming containers." />
          </div>

          <div className="segmented-control segmented-control-compact" role="group" aria-label="Compilation mode">
            <button
              type="button"
              id="comp-mode-standard"
              aria-pressed={compileMode === "standard"}
              className={`segmented-btn segmented-btn-compact ${compileMode === "standard" ? "active" : ""}`}
              onClick={() => onChangeCompileMode("standard")}
            >
              Standard Preset
            </button>
            <button
              type="button"
              id="comp-mode-custom"
              aria-pressed={compileMode === "custom"}
              className={`segmented-btn segmented-btn-compact ${compileMode === "custom" ? "active" : ""}`}
              onClick={() => onChangeCompileMode("custom")}
            >
              Custom Multi-Source
            </button>
          </div>
        </div>

        {/* Standard Mode Form */}
        {compileMode === "standard" && (
          <StandardCompileForm
            datasets={datasets}
            presets={presets}
            presetsError={presetsError}
            selectedManifold={selectedManifold}
            onSelectManifold={onSelectManifold}
            selectedPreset={selectedPreset}
            onSelectPreset={onSelectPreset}
            compileMaxGb={compileMaxGb}
            onChangeCompileMaxGb={onChangeCompileMaxGb}
            compileWorkers={compileWorkers}
            onChangeCompileWorkers={onChangeCompileWorkers}
            compileShardExt={compileShardExt}
            onChangeCompileShardExt={onChangeCompileShardExt}
            compileStartDate={compileStartDate}
            onChangeCompileStartDate={onChangeCompileStartDate}
            compileEndDate={compileEndDate}
            onChangeCompileEndDate={onChangeCompileEndDate}
            compileLabelStrategy={compileLabelStrategy}
            onChangeCompileLabelStrategy={onChangeCompileLabelStrategy}
            isCompiling={isCompiling}
            compileStatus={compileStatus}
            onDismissCompileStatus={onDismissCompileStatus}
            onCompile={onCompile}
            datasetCompilerOnline={datasetCompilerOnline}
          />
        )}

        {/* Custom Mode Form */}
        {compileMode === "custom" && (
          <CustomCompileForm
            presets={presets}
            presetsError={presetsError}
            customName={customName}
            onChangeCustomName={onChangeCustomName}
            customTask={customTask}
            onChangeCustomTask={onChangeCustomTask}
            customPreset={customPreset}
            onChangeCustomPreset={onChangeCustomPreset}
            customCanonicalFormat={customCanonicalFormat}
            onChangeCustomCanonicalFormat={onChangeCustomCanonicalFormat}
            customShardSize={customShardSize}
            onChangeCustomShardSize={onChangeCustomShardSize}
            customSourcesText={customSourcesText}
            onChangeCustomSourcesText={onChangeCustomSourcesText}
            customPurgeLoose={customPurgeLoose}
            onToggleCustomPurgeLoose={onToggleCustomPurgeLoose}
            isCustomCompiling={isCustomCompiling}
            customCompileStatus={customCompileStatus}
            onDismissCustomCompileStatus={onDismissCustomCompileStatus}
            onCustomCompile={onCustomCompile}
            datasetCompilerOnline={datasetCompilerOnline}
          />
        )}

        {!datasetCompilerOnline && (
          <ValidationBanner
            type="error"
            message={`Dataset Compiler Sidecar (Port ${servicePort("dataset-compiler")}) is offline. Launch ${ecosystemService("dataset-compiler").project} to enable compilation.`}
            className="banner-space-top-sm banner-text-sm"
          />
        )}
      </div>
    </div>
  );
};
