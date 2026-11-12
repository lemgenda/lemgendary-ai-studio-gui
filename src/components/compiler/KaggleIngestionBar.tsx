import React from "react";
import { HelpTooltip } from "../HelpTooltip";
import { ValidationBanner } from "../common/ValidationBanner";
import { DatasetCompilationFormProps } from "./DatasetCompilationForm";
import { kaggleAuthSources, useKaggleIngestionSources } from "./useKaggleIngestionSources";
import { KaggleStatusResponse } from "../../api/types";

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

/** Credential badge of the Dataset Compiler's Kaggle access. */
const KaggleAuthBadge: React.FC<{ status: KaggleStatusResponse | null; online: boolean }> = ({ status, online }) => {
  if (!online || !status) {
    return (
      <span id="comp-badge-kaggle-auth" className="badge badge-secondary">
        {online ? "Kaggle: checking..." : "Kaggle: compiler offline"}
      </span>
    );
  }
  const sources = kaggleAuthSources(status);
  return status.authenticated ? (
    <span id="comp-badge-kaggle-auth" className="badge badge-success" title={`Credentials found in: ${sources.join(", ")}`}>
      Kaggle: credentials found
    </span>
  ) : (
    <span id="comp-badge-kaggle-auth" className="badge badge-error" title="Add a Kaggle token in Config & Secrets">
      Kaggle: no credentials
    </span>
  );
};

/** Direct Kaggle cloud ingestion bar: registry pick or link/slug, target folder, force overwrite. */
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
}) => {
  const { status, registry, isLoading, reload } = useKaggleIngestionSources(datasetCompilerOnline);
  const pickedRegistryItem = registry.find((item) => item.kaggle_ref === customKaggleRef);

  /** A registry pick fills the reference and its modernized target folder. */
  const handlePickRegistry = (kaggleRef: string) => {
    const item = registry.find((entry) => entry.kaggle_ref === kaggleRef);
    onChangeCustomKaggleRef(kaggleRef);
    onChangeDownloadTargetFolder(item ? item.modernized_folder : "");
  };

  return (
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
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Format: username/dataset-slug or https://www.kaggle.com/datasets/...
          </span>
          <KaggleAuthBadge status={status} online={datasetCompilerOnline} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
        <select
          id="comp-select-kaggle-registry"
          className="editor-input"
          aria-label="Registry manifold with a Kaggle reference"
          value={pickedRegistryItem ? pickedRegistryItem.kaggle_ref : ""}
          onChange={(e) => handlePickRegistry(e.target.value)}
          disabled={isDownloadingKaggle || !datasetCompilerOnline || registry.length === 0}
          style={{ fontSize: "12px", padding: "6px 10px" }}
        >
          <option value="">
            {registry.length === 0 ? "No registry manifolds with a Kaggle reference" : "Pick a registry manifold (or type a slug below)..."}
          </option>
          {registry.map((item) => (
            <option key={item.key} value={item.kaggle_ref}>
              {item.title} ({item.clean_repo_id}){item.is_local_present ? " - local copy present" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          id="comp-btn-kaggle-registry-reload"
          className="btn btn-secondary"
          onClick={() => void reload()}
          disabled={isLoading || !datasetCompilerOnline}
          style={{ fontSize: "12px", padding: "6px 14px", whiteSpace: "nowrap" }}
        >
          {isLoading ? "Loading..." : "Reload Registry"}
        </button>
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
};
