import React from "react";
import { HelpTooltip } from "../HelpTooltip";
import { ValidationBanner } from "../common/ValidationBanner";
import { DatasetCompilationFormProps } from "./DatasetCompilationForm";

type KaggleIngestionBarProps = Pick<
  DatasetCompilationFormProps,
  | "customKaggleRef"
  | "onChangeCustomKaggleRef"
  | "downloadTargetFolder"
  | "onChangeDownloadTargetFolder"
  | "downloadForce"
  | "onToggleDownloadForce"
  | "isDownloadingKaggle"
  | "downloadStatus"
  | "onDownloadKaggleDirect"
  | "datasetCompilerOnline"
>;

/** Direct Kaggle cloud ingestion bar: link or slug, target folder, force overwrite. */
export const KaggleIngestionBar: React.FC<KaggleIngestionBarProps> = ({
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
}) => (
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
        <HelpTooltip content="Download any public or private dataset from Kaggle into LemGendaryDatasets using its dataset slug (owner/dataset-name) or full URL." />
      </div>
      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
        Format: username/dataset-slug or https://www.kaggle.com/datasets/...
      </span>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 180px auto auto", gap: "10px", alignItems: "center" }}>
      <input
        id="comp-input-kaggle-custom-ref"
        type="text"
        className="editor-input"
        aria-label="Kaggle dataset slug or URL"
        placeholder="e.g. owner/dataset-name or https://www.kaggle.com/datasets/..."
        value={customKaggleRef}
        onChange={(e) => onChangeCustomKaggleRef(e.target.value)}
        disabled={isDownloadingKaggle}
        style={{ fontSize: "12px", padding: "6px 10px" }}
      />

      <input
        type="text"
        className="editor-input"
        aria-label="Target folder under LemGendaryDatasets (optional)"
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
);
