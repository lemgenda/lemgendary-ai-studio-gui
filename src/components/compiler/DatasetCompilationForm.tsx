import React from "react";
import { HelpTooltip } from "../HelpTooltip";
import { ValidationBanner } from "../common/ValidationBanner";
import { CompilerPreset, DatasetItem } from "../../api/types";

export interface DatasetCompilationFormProps {
  datasets: DatasetItem[];
  presets: CompilerPreset[];
  selectedManifold: string;
  onSelectManifold: (key: string) => void;
  selectedPreset: string;
  onSelectPreset: (presetId: string) => void;
  shardSize: number;
  onChangeShardSize: (size: number) => void;
  purgeLooseImages: boolean;
  onTogglePurgeLooseImages: (purge: boolean) => void;
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

export const DatasetCompilationForm: React.FC<DatasetCompilationFormProps> = ({
  datasets,
  presets,
  selectedManifold,
  onSelectManifold,
  selectedPreset,
  onSelectPreset,
  shardSize,
  onChangeShardSize,
  purgeLooseImages,
  onTogglePurgeLooseImages,
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
      <div
        style={{
          background: "rgba(0,0,0,0.25)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          padding: "14px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase" }}>
              Direct Kaggle Ingestion:
            </span>
            <HelpTooltip content="Download any public or private dataset from Kaggle into LemGendaryDatasets using its dataset slug (e.g. lemtreursi/forexuniverse) or full URL." />
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Format: username/dataset-slug or https://www.kaggle.com/datasets/...
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px auto auto", gap: "10px", alignItems: "center" }}>
          <input
            type="text"
            className="editor-input"
            placeholder="e.g. lemtreursi/forexuniverse or https://www.kaggle.com/datasets/..."
            value={customKaggleRef}
            onChange={(e) => onChangeCustomKaggleRef(e.target.value)}
            disabled={isDownloadingKaggle}
            style={{ fontSize: "12px", padding: "6px 10px" }}
          />

          <input
            type="text"
            className="editor-input"
            placeholder="Target folder (optional)"
            value={downloadTargetFolder}
            onChange={(e) => onChangeDownloadTargetFolder(e.target.value)}
            disabled={isDownloadingKaggle}
            style={{ fontSize: "12px", padding: "6px 10px" }}
          />

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "var(--text-secondary)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={downloadForce}
              onChange={(e) => onToggleDownloadForce(e.target.checked)}
              disabled={isDownloadingKaggle}
            />
            <span>Force Re-download</span>
          </label>

          <button
            type="button"
            className="btn btn-cloud"
            onClick={onDownloadKaggleDirect}
            disabled={!customKaggleRef || isDownloadingKaggle || !datasetCompilerOnline}
            style={{ fontSize: "12px", padding: "6px 14px", fontWeight: 600, whiteSpace: "nowrap" }}
          >
            {isDownloadingKaggle ? "Ingesting..." : "Ingest from Kaggle"}
          </button>
        </div>

        {downloadStatus && (
          <ValidationBanner
            message={downloadStatus}
            style={{ marginTop: "10px", fontSize: "12px" }}
          />
        )}
      </div>

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
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label
                  htmlFor="shard-size-input"
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Shard Size (Samples):
                </label>
                <input
                  id="shard-size-input"
                  type="number"
                  className="editor-input"
                  value={shardSize}
                  onChange={(e) => onChangeShardSize(Number(e.target.value))}
                  disabled={isCompiling}
                  min={100}
                  max={50000}
                  style={{ fontSize: "12px", padding: "6px 8px" }}
                />
              </div>

              <div
                className="form-group"
                style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "22px" }}
              >
                <input
                  id="purge-loose-check"
                  type="checkbox"
                  checked={purgeLooseImages}
                  onChange={(e) => onTogglePurgeLooseImages(e.target.checked)}
                  disabled={isCompiling}
                />
                <label
                  htmlFor="purge-loose-check"
                  style={{ fontSize: "12px", color: "var(--text-primary)", cursor: "pointer", userSelect: "none" }}
                >
                  Purge loose images post-compilation
                </label>
                <HelpTooltip content="When enabled, deletes redundant uncompressed loose image files after writing shards to eliminate dual-storage disk amplification." />
              </div>
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
              <HelpTooltip content="Launch multi-threaded compilation. Transcodes samples to lossless WebP, builds container indexes, and purges redundant loose images." />
            </div>

            {compileStatus && (
              <ValidationBanner
                message={compileStatus}
                style={{ marginTop: "12px", fontSize: "12px" }}
              />
            )}
          </div>
        )}

        {/* Custom Mode Form */}
        {compileMode === "custom" && (
          <div>
            <div
              className="form-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
                marginBottom: "14px",
              }}
            >
              <div className="form-group">
                <label
                  htmlFor="custom-name-input"
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Manifold Name:
                </label>
                <input
                  id="custom-name-input"
                  type="text"
                  className="editor-input"
                  placeholder="e.g. FineArtPortraitsV1"
                  value={customName}
                  onChange={(e) => onChangeCustomName(e.target.value)}
                  disabled={isCustomCompiling}
                  style={{ fontSize: "12px", padding: "6px 8px" }}
                />
              </div>

              <div className="form-group">
                <label
                  htmlFor="custom-task-select"
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Task Category:
                </label>
                <select
                  id="custom-task-select"
                  className="editor-select"
                  value={customTask}
                  onChange={(e) => onChangeCustomTask(e.target.value)}
                  disabled={isCustomCompiling}
                  style={{ fontSize: "12px", padding: "6px 8px" }}
                >
                  <option value="restoration">Restoration &amp; Enhancement</option>
                  <option value="detection">Detection &amp; Localization</option>
                  <option value="classification">Classification &amp; Filtering</option>
                  <option value="quality">Aesthetic &amp; Quality Scoring</option>
                  <option value="vision">General Computer Vision</option>
                </select>
              </div>

              <div className="form-group">
                <label
                  htmlFor="custom-format-select"
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Container Format:
                </label>
                <select
                  id="custom-format-select"
                  className="editor-select"
                  value={customCanonicalFormat}
                  onChange={(e) =>
                    onChangeCustomCanonicalFormat(
                      e.target.value as "webdataset" | "parquet" | "mds" | "litdata"
                    )
                  }
                  disabled={isCustomCompiling}
                  style={{ fontSize: "12px", padding: "6px 8px" }}
                >
                  <option value="webdataset">WebDataset Streaming (.data shards)</option>
                  <option value="parquet">Columnar Parquet (.parquet)</option>
                  <option value="mds">MosaicML Streaming (.mds shards)</option>
                  <option value="litdata">PyTorch Lightning LitData (.bin)</option>
                </select>
              </div>

              <div className="form-group">
                <label
                  htmlFor="custom-preset-select"
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Compression Profile:
                </label>
                <select
                  id="custom-preset-select"
                  className="editor-select"
                  value={customPreset}
                  onChange={(e) => onChangeCustomPreset(e.target.value)}
                  disabled={isCustomCompiling}
                  style={{ fontSize: "12px", padding: "6px 8px" }}
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label
                  htmlFor="custom-shard-size"
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Samples Per Shard:
                </label>
                <input
                  id="custom-shard-size"
                  type="number"
                  className="editor-input"
                  value={customShardSize}
                  onChange={(e) => onChangeCustomShardSize(Number(e.target.value))}
                  disabled={isCustomCompiling}
                  min={100}
                  max={50000}
                  style={{ fontSize: "12px", padding: "6px 8px" }}
                />
              </div>

              <div
                className="form-group"
                style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "22px" }}
              >
                <input
                  id="custom-purge-check"
                  type="checkbox"
                  checked={customPurgeLoose}
                  onChange={(e) => onToggleCustomPurgeLoose(e.target.checked)}
                  disabled={isCustomCompiling}
                />
                <label
                  htmlFor="custom-purge-check"
                  style={{ fontSize: "12px", color: "var(--text-primary)", cursor: "pointer", userSelect: "none" }}
                >
                  Purge loose source images
                </label>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "14px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "4px",
                }}
              >
                <label
                  htmlFor="custom-sources-area"
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  Source Repositories &amp; URLs (One per line):
                </label>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Prefixes: kaggle:// | hf:// | gd:// | gh:// or raw URLs
                </span>
              </div>
              <textarea
                id="custom-sources-area"
                className="editor-textarea"
                rows={3}
                placeholder={
                  "# Enter source repositories or direct links, one per line:\nkaggle://username/dataset-slug\nhttps://huggingface.co/datasets/org/dataset-name\nhttps://github.com/owner/repository"
                }
                value={customSourcesText}
                onChange={(e) => onChangeCustomSourcesText(e.target.value)}
                disabled={isCustomCompiling}
                style={{ fontSize: "12px", padding: "8px" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onCustomCompile}
                disabled={isCustomCompiling || !datasetCompilerOnline}
                style={{ fontSize: "12px", padding: "6px 14px", fontWeight: 600 }}
              >
                {isCustomCompiling ? "Compiling Custom Manifold..." : "Compile Custom Dataset"}
              </button>
            </div>

            {customCompileStatus && (
              <ValidationBanner
                message={customCompileStatus}
                style={{ marginTop: "12px", fontSize: "12px" }}
              />
            )}
          </div>
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
