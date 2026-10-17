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
    <div style={{ padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <div>
          <h4 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
            Container Modernization &amp; Publication Queue
          </h4>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
            Automated streaming transcode into WebDataset (.data), MosaicML (.mds), or Parquet shards with Kaggle publication.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
            <span>Workers:</span>
            <input
              type="number"
              min={1}
              max={16}
              value={modernizeWorkers}
              onChange={(e) => setModernizeWorkers(Number(e.target.value))}
              className="editor-input"
              style={{ width: "60px", padding: "4px 8px", fontSize: "12px" }}
            />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={modernizePushKaggle}
              onChange={(e) => setModernizePushKaggle(e.target.checked)}
            />
            <span>Push Kaggle</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={modernizeForce}
              onChange={(e) => setModernizeForce(e.target.checked)}
            />
            <span>Force</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={modernizeDryRun}
              onChange={(e) => setModernizeDryRun(e.target.checked)}
            />
            <span>Dry Run</span>
          </label>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onScanQueue}
            disabled={isLoadingQueue}
            style={{ fontSize: "12px", padding: "5px 12px" }}
          >
            {isLoadingQueue ? "Scanning..." : "Scan Queue"}
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onRunModernize()}
            disabled={isModernizing || !datasetCompilerOnline}
            style={{ fontSize: "12px", padding: "5px 12px", fontWeight: 600 }}
          >
            {isModernizing ? "Processing Queue..." : "Batch Modernize All"}
          </button>
        </div>
      </div>

      {modernizeStatus && (
        <ValidationBanner
          message={modernizeStatus}
          style={{ marginBottom: "16px", fontSize: "12px" }}
        />
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", fontSize: "11px", textTransform: "uppercase" }}>
              <th style={{ padding: "8px 10px" }}>Dataset Key</th>
              <th style={{ padding: "8px 10px" }}>Target Folder</th>
              <th style={{ padding: "8px 10px" }}>Canonical Format</th>
              <th style={{ padding: "8px 10px" }}>Queue Status</th>
              <th style={{ padding: "8px 10px" }}>Diagnostic Details</th>
              <th style={{ padding: "8px 10px", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {queueItems.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
                  {isLoadingQueue ? "Scanning modernization queue..." : "No items in queue or catalog is up to date."}
                </td>
              </tr>
            ) : (
              queueItems.map((item) => (
                <tr key={item.dataset_key} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600, color: "var(--text-primary)" }}>
                    {item.dataset_key}
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                    {item.modernized_folder}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <span className="badge badge-secondary" style={{ fontSize: "10px", textTransform: "uppercase" }}>
                      {item.canonical_format}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <span
                      className={`badge ${
                        item.status === "NEEDS_CONVERSION"
                          ? "badge-warning"
                          : item.status === "NEEDS_PUSH"
                          ? "badge-info"
                          : "badge-success"
                      }`}
                      style={{ fontSize: "10px" }}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: "11px" }}>
                    {item.reason}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => onRunModernize(item.dataset_key)}
                      disabled={isModernizing || !datasetCompilerOnline}
                      style={{ fontSize: "11px", padding: "3px 8px" }}
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
