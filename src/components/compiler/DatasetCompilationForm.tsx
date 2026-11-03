import React from "react";
import { HelpTooltip } from "../HelpTooltip";
import { KaggleIngestionBar } from "./KaggleIngestionBar";
import { StandardCompileForm } from "./StandardCompileForm";
import { CustomCompileForm } from "./CustomCompileForm";
import { ValidationBanner } from "../common/ValidationBanner";
import { CompilerPreset, DatasetItem } from "../../api/types";

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
  isCompiling: boolean;
  compileStatus: string | null;
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
  onCustomCompile: () => void;
  customKaggleRef: string;
  onChangeCustomKaggleRef: (ref: string) => void;
  downloadTargetFolder: string;
  onChangeDownloadTargetFolder: (folder: string) => void;
  downloadForce: boolean;
  onToggleDownloadForce: (force: boolean) => void;
  isDownloadingKaggle: boolean;
  downloadStatus: string | null;
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
  isCompiling,
  compileStatus,
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
  onCustomCompile,
  customKaggleRef,
  onChangeCustomKaggleRef,
  downloadTargetFolder,
  onChangeDownloadTargetFolder,
  downloadForce,
  onToggleDownloadForce,
  isDownloadingKaggle,
  downloadStatus,
  onDownloadKaggleDirect,
  datasetCompilerOnline,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
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
        onDownloadKaggleDirect={onDownloadKaggleDirect}
        datasetCompilerOnline={datasetCompilerOnline}
      />

      {/* ── Compilation Mode Form (Standard vs Custom) ── */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h4 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              Dataset Compilation Engine
            </h4>
            <HelpTooltip content="Compile raw multi-source imagery into production WebDataset (.data) or MosaicML Streaming containers." />
          </div>

          <div className="segmented-control" style={{ maxWidth: "260px" }}>
            <button
              type="button"
              className={`segmented-btn ${compileMode === "standard" ? "active" : ""}`}
              onClick={() => onChangeCompileMode("standard")}
              style={{ fontSize: "11px", padding: "4px 10px" }}
            >
              Standard Preset
            </button>
            <button
              type="button"
              className={`segmented-btn ${compileMode === "custom" ? "active" : ""}`}
              onClick={() => onChangeCompileMode("custom")}
              style={{ fontSize: "11px", padding: "4px 10px" }}
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
            isCompiling={isCompiling}
            compileStatus={compileStatus}
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
            onCustomCompile={onCustomCompile}
            datasetCompilerOnline={datasetCompilerOnline}
          />
        )}

        {!datasetCompilerOnline && (
          <ValidationBanner
            type="error"
            message="Dataset Compiler Sidecar (Port 8100) is offline. Launch lemgendary-datasets to enable compilation."
            style={{ marginTop: "12px", fontSize: "12px" }}
          />
        )}
      </div>
    </div>
  );
};
