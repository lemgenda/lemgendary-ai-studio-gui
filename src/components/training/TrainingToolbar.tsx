import React from "react";
import { HelpTooltip } from "../HelpTooltip";
import { servicePort } from "../../api/config";

export interface TrainingToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (category: string) => void;
  archFilter: string;
  onArchFilterChange: (arch: string) => void;
  uniqueCategories: string[];
  uniqueArchitectures: { arch: string; count: number }[];
  onResetFilters: () => void;
  trainingSuiteOnline: boolean;
  isGeneratingAllNotebooks: boolean;
  onGenerateAllNotebooks: () => void;
  isPushingAllKaggle: boolean;
  onPushAllKaggle: () => void;
  isRefreshing: boolean;
  onRefreshModels: () => void;
  totalModelsCount: number;
  filteredModelsCount: number;
}

export const TrainingToolbar: React.FC<TrainingToolbarProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  archFilter,
  onArchFilterChange,
  uniqueCategories,
  uniqueArchitectures,
  onResetFilters,
  trainingSuiteOnline,
  isGeneratingAllNotebooks,
  onGenerateAllNotebooks,
  isPushingAllKaggle,
  onPushAllKaggle,
  isRefreshing,
  onRefreshModels,
  totalModelsCount,
  filteredModelsCount,
}) => {
  const hasActiveFilters =
    searchQuery !== "" ||
    statusFilter !== "ALL" ||
    categoryFilter !== "ALL" ||
    archFilter !== "ALL";

  return (
    <div className="toolbar-wrapper">
      {/* Top Header & Fleet Action Buttons */}
      <div className="toolbar-header">
        <div className="row-gap-md">
          <h3 className="card-heading-bold">
            Model Registry &amp; Training Manifolds ({filteredModelsCount} / {totalModelsCount})
          </h3>
          <HelpTooltip content="Centralized model management hub. Supports local PyTorch execution, automated notebook generation, and isolated Kaggle variation staging." />
        </div>

        <div className="row-gap-md row-wrap">
          <button
            type="button"
            id="train-btn-generate-all-notebooks"
            className="btn btn-secondary btn-toolbar"
            onClick={onGenerateAllNotebooks}
            disabled={isGeneratingAllNotebooks || !trainingSuiteOnline}
            title="Batch generate Jupyter notebooks across all registered neural models"
          >
            <span>{isGeneratingAllNotebooks ? "Generating Notebooks..." : "Generate All Notebooks"}</span>
          </button>

          <button
            type="button"
            id="training-toolbar-push-all-models-btn"
            className="btn btn-secondary btn-toolbar"
            onClick={onPushAllKaggle}
            disabled={isPushingAllKaggle || !trainingSuiteOnline}
            title="Stage and publish all registered models, checkpoints, and variations to Kaggle Models Hub"
          >
            <span>{isPushingAllKaggle ? "Pushing All Models..." : "Push All Models to Kaggle"}</span>
          </button>

          <button
            type="button"
            id="train-btn-refresh-models"
            className="btn btn-secondary btn-toolbar"
            onClick={onRefreshModels}
            disabled={isRefreshing}
            aria-label="Refresh model checkpoints and telemetry from sidecar"
          >
            <span>{isRefreshing ? "Refreshing..." : "Refresh Models"}</span>
          </button>
          <HelpTooltip content={`Poll port ${servicePort("training-suite")} sidecar to update model weights status, metrics.csv progress, and resolution ladder completion.`} />
        </div>
      </div>

      {/* Search & Filter Toolbar Controls */}
      <div className="filter-bar">
        {/* Live Search Input */}
        <div className="filter-search-box">
          <input
            type="text"
            aria-label="Filter models by name, architecture or category"
            placeholder="Filter by model name, architecture, category..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="editor-input form-control-wide-md"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear model filter"
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
            <option value="FULLY_TRAINED">Fully Trained</option>
            <option value="PARTIALLY_TRAINED">Partially Trained</option>
            <option value="WEIGHTS_READY">Weights Ready</option>
            <option value="INITIALIZING">Initializing</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </div>

        {/* Category Filter */}
        <div className="row-gap-sm">
          <span className="filter-label">
            Category:
          </span>
          <select
            aria-label="Category filter"
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="editor-select filter-select"
          >
            <option value="ALL">All Categories</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Architecture Filter */}
        <div className="row-gap-sm">
          <span className="filter-label">
            Architecture:
          </span>
          <select
            aria-label="Architecture filter"
            value={archFilter}
            onChange={(e) => onArchFilterChange(e.target.value)}
            className="editor-select filter-select"
          >
            <option value="ALL">All Architectures</option>
            {uniqueArchitectures.map(({ arch, count }) => (
              <option key={arch} value={arch}>
                {arch} ({count})
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
    </div>
  );
};
