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
    <div className="ingestion-bar">
      <div className="ingestion-header">
        <div className="row-gap-sm">
          <span className="ingestion-title">
            Direct Kaggle Ingestion:
          </span>
          <HelpTooltip content="Download any public or private dataset from Kaggle into LemGendaryDatasets using its dataset slug (owner/dataset-name) or full URL." />
        </div>
        <div className="row-gap-md">
          <span className="ingestion-format-hint">
            Format: username/dataset-slug or https://www.kaggle.com/datasets/...
          </span>
          <KaggleAuthBadge status={status} online={datasetCompilerOnline} />
        </div>
      </div>

      <div className="ingestion-registry-row">
        <select
          id="comp-select-kaggle-registry"
          className="editor-input form-control-md"
          aria-label="Registry manifold with a Kaggle reference"
          value={pickedRegistryItem ? pickedRegistryItem.kaggle_ref : ""}
          onChange={(e) => handlePickRegistry(e.target.value)}
          disabled={isDownloadingKaggle || !datasetCompilerOnline || registry.length === 0}
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
          className="btn btn-secondary btn-action-compact btn-nowrap"
          onClick={() => void reload()}
          disabled={isLoading || !datasetCompilerOnline}
        >
          {isLoading ? "Loading..." : "Reload Registry"}
        </button>
      </div>

      <div className="ingestion-controls-row">
        <input
          id="comp-input-kaggle-custom-ref"
          type="text"
          className="editor-input form-control-md"
          aria-label="Kaggle dataset slug or URL"
          placeholder="e.g. owner/dataset-name or https://www.kaggle.com/datasets/..."
          value={customKaggleRef}
          onChange={(e) => onChangeCustomKaggleRef(e.target.value)}
          disabled={isDownloadingKaggle}
        />

        <input
          type="text"
          className="editor-input form-control-md"
          aria-label="Target folder under LemGendaryDatasets (optional)"
          placeholder="Target folder (optional)"
          value={downloadTargetFolder}
          onChange={(e) => onChangeDownloadTargetFolder(e.target.value)}
          disabled={isDownloadingKaggle}
        />

        <label className="checkbox-label-compact">
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
          className="btn btn-cloud btn-action-bold btn-nowrap"
          onClick={onDownloadKaggleDirect}
          disabled={!customKaggleRef || isDownloadingKaggle || !datasetCompilerOnline}
        >
          {isDownloadingKaggle ? "Ingesting..." : "Ingest from Kaggle"}
        </button>
      </div>

      {downloadStatus && (
        <ValidationBanner
          message={downloadStatus}
          className="banner-space-top-xs banner-text-sm"
        />
      )}
    </div>
  );
};
