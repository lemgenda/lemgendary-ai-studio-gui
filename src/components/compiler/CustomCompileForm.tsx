import React from "react";
import { ValidationBanner } from "../common/ValidationBanner";
import { PresetOptions } from "./PresetOptions";
import { DatasetCompilationFormProps } from "./DatasetCompilationForm";

type CustomCompileFormProps = Pick<
  DatasetCompilationFormProps,
  | "presets"
  | "presetsError"
  | "customName"
  | "onChangeCustomName"
  | "customTask"
  | "onChangeCustomTask"
  | "customPreset"
  | "onChangeCustomPreset"
  | "customCanonicalFormat"
  | "onChangeCustomCanonicalFormat"
  | "customShardSize"
  | "onChangeCustomShardSize"
  | "customSourcesText"
  | "onChangeCustomSourcesText"
  | "customPurgeLoose"
  | "onToggleCustomPurgeLoose"
  | "isCustomCompiling"
  | "customCompileStatus"
  | "onCustomCompile"
  | "datasetCompilerOnline"
>;

/** Custom mode: compile a new manifold from multiple Kaggle, Hugging Face, Google Drive or GitHub sources. */
export const CustomCompileForm: React.FC<CustomCompileFormProps> = ({
  presets,
  presetsError,
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
  datasetCompilerOnline,
}) => (
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
          <PresetOptions presets={presets} presetsError={presetsError} />
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
);
