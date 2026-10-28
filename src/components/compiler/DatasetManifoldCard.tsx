import React from "react";
import { HelpTooltip } from "../HelpTooltip";
import { HoverPinPopover } from "../common/HoverPinPopover";
import { DatasetItem } from "../../api/types";

export interface DatasetManifoldCardProps {
  dataset: DatasetItem;
  isBusy: boolean;
  actionBusyKey: string | null;
  isSourcesPinned: boolean;
  onToggleSourcesPin: () => void;
  onUpdateMetadataSingle: (dataset: DatasetItem) => void;
  onDownloadManifold: (dataset: DatasetItem) => void;
  onUploadManifold: (dataset: DatasetItem) => void;
  datasetCompilerOnline: boolean;
}

export const DatasetManifoldCard: React.FC<DatasetManifoldCardProps> = ({
  dataset: d,
  isBusy,
  actionBusyKey,
  isSourcesPinned,
  onToggleSourcesPin,
  onUpdateMetadataSingle,
  onDownloadManifold,
  onUploadManifold,
  datasetCompilerOnline,
}) => {
  const isDirectoryFormat = d.canonical_format === "directory" || d.format === "directory";

  return (
    <div
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        padding: "16px",
      }}
    >
      {/* 1. Manifold Name: Full-width at the very top */}
      <div style={{ width: "100%", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
        <h4 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-primary)", lineHeight: 1.3, flex: 1 }}>
          {d.display_name}
        </h4>
        <HelpTooltip
          content={`Authoritative key: ${d.key}. Local directory: ${d.modernized_folder || d.key}. Canonical format: ${
            d.canonical_format || d.format
          }.`}
        />
      </div>

      {/* 2. Compilation Status / Format Badge: Full-width directly below name */}
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          background: "rgba(255,255,255,0.03)",
          padding: "6px 10px",
          borderRadius: "6px",
          border: "1px solid var(--border-color)",
        }}
      >
        <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
          Manifold Status:
        </span>
        <div>
          {d.is_compiled ? (
            <span className="badge badge-success" style={{ fontWeight: 700 }}>
              COMPILED
            </span>
          ) : (
            <span className="badge badge-warning" style={{ fontWeight: 700 }}>
              UNCOMPILED
            </span>
          )}
        </div>
      </div>

      {/* 3. Metric Specs Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
        <div className="metric-row">
          <span className="metric-label">Storage Format</span>
          <span className="metric-value" style={{ textTransform: "uppercase", fontWeight: 600 }}>
            {d.canonical_format || d.format}
          </span>
        </div>

        <div className="metric-row">
          <span className="metric-label">Total Samples</span>
          <span className="metric-value">{d.total_samples.toLocaleString()}</span>
        </div>

        <div className="metric-row">
          <span className="metric-label">Disk Footprint</span>
          <span className="metric-value">{(d.total_size_mb / 1024).toFixed(1)} GB</span>
        </div>

        <div className="metric-row">
          <span className="metric-label">
            {isDirectoryFormat ? "Dataset Splits" : "Container Shards"}
          </span>
          <span
            className="metric-value"
            style={{ fontWeight: 600, color: d.shards_count && d.shards_count > 0 ? "var(--accent-emerald)" : undefined }}
          >
            {isDirectoryFormat ? `${d.shards_count || 2} splits (train/val)` : `${d.shards_count || 0} shards`}
          </span>
        </div>

        {/* 4. Expandable Upstream Sources Row using HoverPinPopover */}
        <HoverPinPopover
          title="Upstream Sources"
          isPinned={isSourcesPinned}
          onTogglePin={onToggleSourcesPin}
          valueBadge={
            <span
              className="metric-value"
              style={{
                color: d.sources && d.sources.length > 0 ? "var(--accent-emerald)" : "var(--text-muted)",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              {d.sources && d.sources.length > 0 ? `${d.sources.length} Sources` : "1 Primary Source"}
            </span>
          }
          ariaLabel={`Upstream sources for ${d.display_name}. Click to pin open.`}
        >
          {d.sources && d.sources.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {d.sources.map((s, idx) => (
                <div
                  key={`${s.name}_${idx}`}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" }}
                >
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "160px",
                    }}
                    title={s.ref || s.name}
                  >
                    {s.name}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      {s.count ? `${s.count.toLocaleString()} samples` : "Active"}
                    </span>
                    <span
                      className="badge badge-secondary"
                      style={{ fontSize: "9px", padding: "1px 5px", textTransform: "uppercase" }}
                    >
                      {s.type || "SOURCE"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </HoverPinPopover>

        {/* 5. Format Breakdown */}
        <div
          style={{
            marginTop: "4px",
            paddingTop: "8px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span>WebP: {d.format_breakdown.webp.toLocaleString()}</span>
          <span>JPG: {d.format_breakdown.jpg.toLocaleString()}</span>
          <span>PNG: {d.format_breakdown.png.toLocaleString()}</span>
        </div>
      </div>

      {/* 4. Action Buttons Toolbar (2x2 Grid) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          marginTop: "auto",
          paddingTop: "10px",
          borderTop: "1px solid var(--border-color)",
        }}
      >
        {/* Top Row: Update Metadata & Audit Notebooks */}
        <button
          id={`comp-btn-meta-${d.key}`}
          type="button"
          className="btn btn-primary"
          onClick={() => onUpdateMetadataSingle(d)}
          disabled={isBusy || !datasetCompilerOnline}
          style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
          title="Push dataset-metadata.json descriptors to Kaggle Cloud"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <span>{actionBusyKey === `meta_${d.key}` ? "Updating..." : "Update Metadata"}</span>
        </button>

        <a
          href="https://www.kaggle.com/code/lemtreursi/registry-metadata-training"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-cloud"
          style={{
            fontSize: "11px",
            padding: "6px 8px",
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
          title="Open Kaggle Registry Metadata Training Audit notebook"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          <span>Audit Notebooks</span>
        </a>

        {/* Bottom Row: Download from Kaggle & Upload to Kaggle */}
        <button
          id={`comp-btn-pull-${d.key}`}
          type="button"
          className="btn btn-vault-pull"
          onClick={() => onDownloadManifold(d)}
          disabled={isBusy || !datasetCompilerOnline}
          style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
          title={`Download ${d.display_name} from Kaggle Cloud Storage`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>{actionBusyKey === `dl_${d.key}` ? "Downloading..." : "Download"}</span>
        </button>

        <button
          id={`comp-btn-push-${d.key}`}
          type="button"
          className="btn btn-vault-push"
          onClick={() => onUploadManifold(d)}
          disabled={isBusy || !datasetCompilerOnline}
          style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
          title={`Upload local ${d.display_name} manifold to Kaggle Cloud`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>{actionBusyKey === `ul_${d.key}` ? "Uploading..." : "Upload"}</span>
        </button>
      </div>
    </div>
  );
};
