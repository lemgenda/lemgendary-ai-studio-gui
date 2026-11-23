import React from "react";
import { HelpTooltip } from "../HelpTooltip";
import { servicePort } from "../../api/config";

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
  isValidatingSchema: boolean;
  onValidateSchema: () => void;
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
  isValidatingSchema,
  onValidateSchema,
  totalDatasetsCount,
  filteredDatasetsCount,
}) => {
  const hasActiveFilters =
    searchQuery !== "" ||
    statusFilter !== "ALL" ||
    formatFilter !== "ALL" ||
    taskFilter !== "ALL";

  return (
    <div className="toolbar-wrapper">
      {/* Top Header & Section Tab Switcher */}
      <div className="toolbar-header">
        <div className="row-gap-lg row-wrap">
          <h3 className="card-heading-bold">
            Dataset Compiler &amp; Manifold Hub ({filteredDatasetsCount} / {totalDatasetsCount})
          </h3>
          <HelpTooltip content="Authoritative compilation hub. Converts loose imagery into high-throughput WebDataset (.data), Parquet, and MDS streaming containers." />

          {/* Section Tabs */}
          <div className="subtab-switcher-pill">
            <button
              id="compiler-subtabs-tab-catalog"
              type="button"
              aria-pressed={activeSectionTab === "catalog"}
              className={`btn btn-compact ${activeSectionTab === "catalog" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => onTabChange("catalog")}
            >
              Manifolds Catalog
            </button>
            <button
              id="compiler-subtabs-tab-queue"
              type="button"
              aria-pressed={activeSectionTab === "modernize"}
              className={`btn btn-compact ${activeSectionTab === "modernize" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => onTabChange("modernize")}
            >
              Modernization Queue
            </button>
            <button
              id="compiler-subtabs-tab-reduce"
              type="button"
              aria-pressed={activeSectionTab === "reduction"}
              className={`btn btn-compact ${activeSectionTab === "reduction" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => onTabChange("reduction")}
            >
              Scale Reduction
            </button>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="row-gap-md row-wrap">
          <button
            id="comp-btn-update-all-kaggle"
            type="button"
            className="btn btn-secondary btn-toolbar"
            onClick={onUpdateAllMetadata}
            disabled={isUpdatingAllMetadata || !datasetCompilerOnline}
            title="Batch push dataset-metadata.json descriptors to Kaggle Cloud for all registered manifolds"
          >
            <span>{isUpdatingAllMetadata ? "Updating Metadata..." : "Update All Kaggle Metadata"}</span>
          </button>

          <button
            id="comp-btn-regen-manifolds"
            type="button"
            className="btn btn-secondary btn-toolbar"
            onClick={onRegenerateIndex}
            disabled={isRegeneratingIndex || !datasetCompilerOnline}
            title="Re-scans all disk manifolds in LemGendaryDatasets and regenerates unified_data.yaml index"
          >
            <span>{isRegeneratingIndex ? "Regenerating..." : "Regen Index"}</span>
          </button>

          <button
            id="compiler-btn-validate-schema"
            type="button"
            className="btn btn-secondary btn-toolbar"
            onClick={onValidateSchema}
            disabled={isValidatingSchema || !datasetCompilerOnline}
            title="Validates unified_data.yaml against the Dataset Compiler config schema (read-only)"
          >
            <span>{isValidatingSchema ? "Validating..." : "Validate Schema"}</span>
          </button>

          <button
            id="comp-btn-refresh-catalog"
            type="button"
            className="btn btn-secondary btn-toolbar"
            onClick={onRefreshCatalog}
            disabled={isRefreshing}
            aria-label="Refresh dataset manifolds from sidecar"
          >
            <span>{isRefreshing ? "Refreshing..." : "Refresh Catalog"}</span>
          </button>
          <HelpTooltip content={`Poll port ${servicePort("dataset-compiler")} sidecar to detect local disk changes and Kaggle Cloud sync status.`} />
        </div>
      </div>

      {/* Filter Controls Bar (Visible on Catalog Tab) */}
      {activeSectionTab === "catalog" && (
        <div className="filter-bar">
          {/* Live Search Input */}
          <div className="filter-search-box">
            <input
              type="text"
              aria-label="Filter manifolds by name, format or task"
              placeholder="Filter by manifold name, format, task..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="editor-input form-control-wide-md"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Clear manifold filter"
                className="btn-clear-search"
              >
                X
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="row-gap-sm">
            <span className="filter-label">
              Status:
            </span>
            <select
              aria-label="Status filter"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="editor-select filter-select"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPILED">Compiled</option>
              <option value="UNCOMPILED">Uncompiled</option>
            </select>
          </div>

          {/* Format Filter */}
          <div className="row-gap-sm">
            <span className="filter-label">
              Format:
            </span>
            <select
              aria-label="Format filter"
              value={formatFilter}
              onChange={(e) => onFormatFilterChange(e.target.value)}
              className="editor-select filter-select"
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
          <div className="row-gap-sm">
            <span className="filter-label">
              Task:
            </span>
            <select
              aria-label="Task filter"
              value={taskFilter}
              onChange={(e) => onTaskFilterChange(e.target.value)}
              className="editor-select filter-select"
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
              className="btn btn-secondary btn-xs"
              onClick={onResetFilters}
            >
              Reset Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};
