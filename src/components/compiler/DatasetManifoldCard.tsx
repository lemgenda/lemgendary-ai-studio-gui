import React, { useState } from "react";
import { HelpTooltip } from "../HelpTooltip";
import { HoverPinPopover } from "../common/HoverPinPopover";
import { DatasetItem } from "../../api/types";
import { ExternalLink } from "../common/ExternalLink";
import { kaggleRefOwner } from "../training/kaggleLinks";

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
  isExpanded?: boolean;
  onToggleExpand?: () => void;
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
  isExpanded: controlledExpanded,
  onToggleExpand,
}) => {
  // Kaggle owner of this manifold (from its kaggle_ref); no link when unknown.
  const auditOwner = kaggleRefOwner(d.kaggle_ref);
  const isDirectoryFormat = d.canonical_format === "directory" || d.format === "directory";
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const handleToggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded((v) => !v);
    }
  };

  return (
    <div className={`card card-compact ${isExpanded ? "expanded" : ""}`}>
      {/* 1. Manifold Name: Full-width collapsible header at the very top */}
      <div className="card-compact-header">
        <button
          type="button"
          onClick={handleToggleExpand}
          aria-expanded={isExpanded}
          className="card-compact-toggle"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`card-compact-chevron ${isExpanded ? "expanded" : ""}`}
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <h4 className="card-compact-title">{d.display_name}</h4>
        </button>
        <HelpTooltip
          content={`Authoritative key: ${d.key}. Local directory: ${d.modernized_folder || d.key}. Canonical format: ${
            d.canonical_format || d.format
          }.`}
        />
      </div>

      {isExpanded && (
        <>

      {/* 2. Compilation Status / Format Badge: Full-width directly below name */}
      <div className="card-status-strip">
        <span className="card-status-label">
          Manifold Status:
        </span>
        <div>
          {d.is_compiled ? (
            <span className="badge badge-success badge-bold">
              COMPILED
            </span>
          ) : (
            <span className="badge badge-warning badge-bold">
              UNCOMPILED
            </span>
          )}
        </div>
      </div>

      {/* 3. Metric Specs Rows */}
      <div className="card-specs-list">
        <div className="metric-row">
          <span className="metric-label">Storage Format</span>
          <span className="metric-value metric-value-upper">
            {d.canonical_format || d.format}
          </span>
        </div>

        <div className="metric-row">
          <span className="metric-label">Total Samples</span>
          <span className="metric-value">{d.total_samples.toLocaleString()}</span>
        </div>

        <div className="metric-row">
          <span className="metric-label">Disk Footprint</span>
          <span className="metric-value">{d.total_size_mb < 100 ? `${d.total_size_mb.toFixed(1)} MB` : `${(d.total_size_mb / 1024).toFixed(1)} GB`}</span>
        </div>

        <div className="metric-row">
          <span className="metric-label">
            {isDirectoryFormat ? "Dataset Splits" : "Container Shards"}
          </span>
          <span
            className={`metric-value metric-value-bold ${d.shards_count && d.shards_count > 0 ? "metric-value-emerald" : ""}`}
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
              className={`metric-value metric-value-highlight ${
                d.sources && d.sources.length > 0 ? "metric-value-emerald" : "metric-value-muted"
              }`}
            >
              {d.sources && d.sources.length > 0 ? `${d.sources.length} Sources` : "1 Primary Source"}
            </span>
          }
          ariaLabel={`Upstream sources for ${d.display_name}. Click to pin open.`}
        >
          {d.sources && d.sources.length > 0 && (
            <div className="stack-xs">
              {d.sources.map((s, idx) => (
                <div
                  key={`${s.name}_${idx}`}
                  className="manifold-source-row"
                >
                  <span
                    className="manifold-source-name"
                    title={s.ref || s.name}
                  >
                    {s.name}
                  </span>
                  <div className="row-gap-md">
                    <span className="manifold-source-count">
                      {s.count ? `${s.count.toLocaleString()} samples` : "Active"}
                    </span>
                    <span className="badge badge-secondary badge-xs-wide badge-upper">
                      {s.type || "SOURCE"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </HoverPinPopover>

        {/* 5. Format Breakdown */}
        <div className="manifold-format-footer">
          <span>WebP: {d.format_breakdown.webp.toLocaleString()}</span>
          <span>JPG: {d.format_breakdown.jpg.toLocaleString()}</span>
          <span>PNG: {d.format_breakdown.png.toLocaleString()}</span>
        </div>
      </div>

      {/* 4. Action Buttons Toolbar (2x2 Grid) */}
      <div className="manifold-card-actions">
        {/* Top Row: Update Metadata & Audit Notebooks */}
        <button
          id={`comp-btn-meta-${d.key}`}
          type="button"
          className="btn btn-primary btn-card-action"
          onClick={() => onUpdateMetadataSingle(d)}
          disabled={isBusy || !datasetCompilerOnline}
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
            className="btn-icon-fixed"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <span>{actionBusyKey === `meta_${d.key}` ? "Updating..." : "Update Metadata"}</span>
        </button>

        {auditOwner && (
        <ExternalLink
          href={`https://www.kaggle.com/code/${encodeURIComponent(auditOwner)}/registry-metadata-training`}
          className="btn btn-cloud btn-card-link"
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
            className="btn-icon-fixed"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          <span>Audit Notebooks</span>
        </ExternalLink>
        )}

        {/* Bottom Row: Download from Kaggle & Upload to Kaggle */}
        <button
          id={`comp-btn-pull-${d.key}`}
          type="button"
          className="btn btn-vault-pull btn-card-action"
          onClick={() => onDownloadManifold(d)}
          disabled={isBusy || !datasetCompilerOnline}
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
            className="btn-icon-fixed"
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
          className="btn btn-vault-push btn-card-action"
          onClick={() => onUploadManifold(d)}
          disabled={isBusy || !datasetCompilerOnline}
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
            className="btn-icon-fixed"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>{actionBusyKey === `ul_${d.key}` ? "Uploading..." : "Upload"}</span>
        </button>
      </div>
        </>
      )}
    </div>
  );
};
