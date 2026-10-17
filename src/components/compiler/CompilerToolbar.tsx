import React from "react";
import { HelpTooltip } from "../HelpTooltip";

export interface CompilerToolbarProps {
  activeSectionTab: "catalog" | "modernize" | "reduction";
  onTabChange: (tab: "catalog" | "modernize" | "reduction") => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (s: string) => void;
  formatFilter: string;
  onFormatFilterChange: (f: string) => void;
  taskFilter: string;
  onTaskFilterChange: (t: string) => void;
  uniqueFormats: string[];
  uniqueTasks: string[];
  onResetFilters: () => void;
  datasetCompilerOnline: boolean;
  isRefreshing: boolean;
  onRefreshCatalog: () => void;
  isUpdatingAllMetadata: boolean;
  onUpdateAllMetadata: () => void;
  isRegeneratingIndex: boolean;
  onRegenerateIndex: () => void;
  totalDatasetsCount: number;
  filteredDatasetsCount: number;
}

export const CompilerToolbar: React.FC<CompilerToolbarProps> = ({
  activeSectionTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  formatFilter,
  onFormatFilterChange,
  taskFilter,
  onTaskFilterChange,
  uniqueFormats,
  uniqueTasks,
  onResetFilters,
  datasetCompilerOnline,
  isRefreshing,
  onRefreshCatalog,
  isUpdatingAllMetadata,
  onUpdateAllMetadata,
  isRegeneratingIndex,
  onRegenerateIndex,
  totalDatasetsCount,
  filteredDatasetsCount,
}) => {
  const hasActiveFilters =
    searchQuery !== "" ||
    statusFilter !== "ALL" ||
    formatFilter !== "ALL" ||
    taskFilter !== "ALL";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
      {/* Top Header & Section Tab Switcher */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
            Dataset Compiler &amp; Manifold Hub ({filteredDatasetsCount} / {totalDatasetsCount})
          </h3>
          <HelpTooltip content="Authoritative compilation hub. Converts loose imagery into high-throughput WebDataset (.data), Parquet, and MDS streaming containers." />

          {/* Section Tabs */}
          <div
            style={{
              display: "inline-flex",
              background: "rgba(0,0,0,0.3)",
              padding: "3px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              gap: "4px",
            }}
          >
            <button
              type="button"
              className={`btn ${activeSectionTab === "catalog" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => onTabChange("catalog")}
              style={{ fontSize: "11px", padding: "4px 10px" }}
            >
              Manifolds Catalog
            </button>
            <button
              type="button"
              className={`btn ${activeSectionTab === "modernize" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => onTabChange("modernize")}
              style={{ fontSize: "11px", padding: "4px 10px" }}
            >
              Modernization Queue
            </button>
            <button
              type="button"
              className={`btn ${activeSectionTab === "reduction" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => onTabChange("reduction")}
              style={{ fontSize: "11px", padding: "4px 10px" }}
            >
              Scale Reduction
            </button>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onUpdateAllMetadata}
            disabled={isUpdatingAllMetadata || !datasetCompilerOnline}
            style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            title="Batch push dataset-metadata.json descriptors to Kaggle Cloud for all registered manifolds"
          >
            <span>{isUpdatingAllMetadata ? "Updating Metadata..." : "Update All Kaggle Metadata"}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onRegenerateIndex}
            disabled={isRegeneratingIndex || !datasetCompilerOnline}
            style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            title="Re-scans all disk manifolds in LemGendaryDatasets and regenerates unified_data.yaml index"
          >
            <span>{isRegeneratingIndex ? "Regenerating..." : "Regen Index"}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onRefreshCatalog}
            disabled={isRefreshing}
            style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            aria-label="Refresh dataset manifolds from sidecar"
          >
            <span>{isRefreshing ? "Refreshing..." : "Refresh Catalog"}</span>
          </button>
          <HelpTooltip content="Poll port 8100 sidecar to detect local disk changes and Kaggle Cloud sync status." />
        </div>
      </div>

      {/* Filter Controls Bar (Visible on Catalog Tab) */}
      {activeSectionTab === "catalog" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            padding: "12px",
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
          }}
        >
          {/* Live Search Input */}
          <div style={{ flex: "1 1 220px", position: "relative" }}>
            <input
              type="text"
              placeholder="Filter by manifold name, format, task..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="editor-input"
              style={{ width: "100%", padding: "6px 10px", fontSize: "12px" }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                X
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
              Status:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="editor-select"
              style={{ padding: "6px 8px", fontSize: "12px" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPILED">Compiled</option>
              <option value="UNCOMPILED">Uncompiled</option>
            </select>
          </div>

          {/* Format Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
              Format:
            </span>
            <select
              value={formatFilter}
              onChange={(e) => onFormatFilterChange(e.target.value)}
              className="editor-select"
              style={{ padding: "6px 8px", fontSize: "12px" }}
            >
              <option value="ALL">All Formats</option>
              {uniqueFormats.map((f) => (
                <option key={f} value={f}>
                  {f.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Task Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
              Task:
            </span>
            <select
              value={taskFilter}
              onChange={(e) => onTaskFilterChange(e.target.value)}
              className="editor-select"
              style={{ padding: "6px 8px", fontSize: "12px" }}
            >
              <option value="ALL">All Tasks</option>
              {uniqueTasks.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onResetFilters}
              style={{ fontSize: "11px", padding: "4px 8px" }}
            >
              Reset Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};
