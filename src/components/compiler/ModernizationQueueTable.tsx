import React from "react";
import { ValidationBanner } from "../common/ValidationBanner";
import type { ModernizationQueueItem } from "../../api/types";

export interface ModernizationQueueTableProps {
  queueItems: ModernizationQueueItem[];
  isLoadingQueue: boolean;
  isModernizing: boolean;
  datasetCompilerOnline: boolean;
  modernizeWorkers: number;
  setModernizeWorkers: (val: number) => void;
  modernizePushKaggle: boolean;
  setModernizePushKaggle: (val: boolean) => void;
  modernizeForce: boolean;
  setModernizeForce: (val: boolean) => void;
  modernizeDryRun: boolean;
  setModernizeDryRun: (val: boolean) => void;
  modernizeStatus: string | null;
  onScanQueue: () => void;
  onRunModernize: (datasetKey?: string) => void;
}

export const ModernizationQueueTable: React.FC<ModernizationQueueTableProps> = ({
  queueItems,
  isLoadingQueue,
  isModernizing,
  datasetCompilerOnline,
  modernizeWorkers,
  setModernizeWorkers,
  modernizePushKaggle,
  setModernizePushKaggle,
  modernizeForce,
  setModernizeForce,
  modernizeDryRun,
  setModernizeDryRun,
  modernizeStatus,
  onScanQueue,
  onRunModernize,
}) => {
  return (
    <div className="compiler-subpanel">
      <div className="modernize-header">
        <div>
          <h4 className="card-section-title">
            Container Modernization &amp; Publication Queue
          </h4>
          <p className="modernize-desc">
            Automated streaming transcode into WebDataset (.data), MosaicML (.mds), or Parquet shards with Kaggle publication.
          </p>
        </div>

        <div className="row-gap-lg row-wrap">
          <label className="modernize-workers-label">
            <span>Workers:</span>
            <input
              type="number"
              min={1}
              max={16}
              value={modernizeWorkers}
              onChange={(e) => setModernizeWorkers(Number(e.target.value))}
              className="editor-input form-control-narrow"
            />
          </label>

          <label className="checkbox-label-compact">
            <input
              type="checkbox"
              checked={modernizePushKaggle}
              onChange={(e) => setModernizePushKaggle(e.target.checked)}
            />
            <span>Push Kaggle</span>
          </label>

          <label className="checkbox-label-compact">
            <input
              type="checkbox"
              checked={modernizeForce}
              onChange={(e) => setModernizeForce(e.target.checked)}
            />
            <span>Force</span>
          </label>

          <label className="checkbox-label-compact">
            <input
              type="checkbox"
              checked={modernizeDryRun}
              onChange={(e) => setModernizeDryRun(e.target.checked)}
            />
            <span>Dry Run</span>
          </label>

          <button
            type="button"
            className="btn btn-secondary btn-toolbar-sm"
            onClick={onScanQueue}
            disabled={isLoadingQueue}
          >
            {isLoadingQueue ? "Scanning..." : "Scan Queue"}
          </button>

          <button
            type="button"
            className="btn btn-primary btn-toolbar-bold"
            onClick={() => onRunModernize()}
            disabled={isModernizing || !datasetCompilerOnline}
          >
            {isModernizing ? "Processing Queue..." : "Batch Modernize All"}
          </button>
        </div>
      </div>

      {modernizeStatus && (
        <ValidationBanner
          message={modernizeStatus}
          className="banner-space-bottom banner-text-sm"
        />
      )}

      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr className="data-table-head-row-upper">
              <th className="data-table-cell-sm">Dataset Key</th>
              <th className="data-table-cell-sm">Target Folder</th>
              <th className="data-table-cell-sm">Canonical Format</th>
              <th className="data-table-cell-sm">Queue Status</th>
              <th className="data-table-cell-sm">Diagnostic Details</th>
              <th className="data-table-cell-sm-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {queueItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="data-table-empty">
                  {isLoadingQueue ? "Scanning modernization queue..." : "No items in queue or catalog is up to date."}
                </td>
              </tr>
            ) : (
              queueItems.map((item) => (
                <tr key={item.key} className="data-table-row">
                  <td className="data-table-cell-sm-bold">
                    {item.key}
                  </td>
                  <td className="data-table-cell-sm-mono">
                    {item.modernized_folder}
                  </td>
                  <td className="data-table-cell-sm">
                    <span className="badge badge-secondary badge-inline-10 badge-upper">
                      {item.canonical_format}
                    </span>
                  </td>
                  <td className="data-table-cell-sm">
                    <span
                      className={`badge ${queueBadgeClass(item)} badge-inline-10`}
                    >
                      {item.status_label}
                    </span>
                  </td>
                  <td className="data-table-cell-sm-muted">
                    {item.source_label}
                  </td>
                  <td className="data-table-cell-sm-right">
                    <button
                      type="button"
                      className="btn btn-secondary btn-2xs"
                      onClick={() => onRunModernize(item.key)}
                      disabled={isModernizing || !datasetCompilerOnline}
                    >
                      Modernize
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/** Badge colour from the server's queue flags: packed, pending, or no source at all. */
function queueBadgeClass(item: ModernizationQueueItem): string {
  if (item.is_containerized) return "badge-success";
  if (item.status_label.startsWith("MISSING")) return "badge-error";
  return "badge-warning";
}
