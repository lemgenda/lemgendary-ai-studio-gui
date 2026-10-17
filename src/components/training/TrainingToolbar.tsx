import React from "react";
import { HelpTooltip } from "../HelpTooltip";

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
  isUnitTestRunning: boolean;
  onRunUnitTestAll: () => void;
  isGeneratingAllNotebooks: boolean;
  onGenerateAllNotebooks: () => void;
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
  isUnitTestRunning,
  onRunUnitTestAll,
  isGeneratingAllNotebooks,
  onGenerateAllNotebooks,
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
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
      {/* Top Header & Fleet Action Buttons */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
            Model Registry &amp; Training Manifolds ({filteredModelsCount} / {totalModelsCount})
          </h3>
          <HelpTooltip content="Centralized model management hub. Supports local PyTorch execution, automated notebook generation, and isolated Kaggle variation staging." />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onRunUnitTestAll}
            disabled={isUnitTestRunning || !trainingSuiteOnline}
            style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            title="Execute non-blocking unit test discovery sweep across all model architectures"
          >
            <span>{isUnitTestRunning ? "Testing Registry..." : "Unit Test All Models"}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onGenerateAllNotebooks}
            disabled={isGeneratingAllNotebooks || !trainingSuiteOnline}
            style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            title="Batch generate Jupyter notebooks across all registered neural models"
          >
            <span>{isGeneratingAllNotebooks ? "Generating Notebooks..." : "Generate All Notebooks"}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onRefreshModels}
            disabled={isRefreshing}
            style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            aria-label="Refresh model checkpoints and telemetry from sidecar"
          >
            <span>{isRefreshing ? "Refreshing..." : "Refresh Models"}</span>
          </button>
          <HelpTooltip content="Poll port 8200 sidecar to update model weights status, metrics.csv progress, and resolution ladder completion." />
        </div>
      </div>

      {/* Search & Filter Toolbar Controls */}
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
            placeholder="Filter by model name, architecture, category..."
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
            <option value="FULLY_TRAINED">Fully Trained</option>
            <option value="PARTIALLY_TRAINED">Partially Trained</option>
            <option value="WEIGHTS_READY">Weights Ready</option>
            <option value="INITIALIZING">Initializing</option>
          </select>
        </div>

        {/* Category Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
            Category:
          </span>
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="editor-select"
            style={{ padding: "6px 8px", fontSize: "12px" }}
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
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
            Architecture:
          </span>
          <select
            value={archFilter}
            onChange={(e) => onArchFilterChange(e.target.value)}
            className="editor-select"
            style={{ padding: "6px 8px", fontSize: "12px" }}
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
            className="btn btn-secondary"
            onClick={onResetFilters}
            style={{ fontSize: "11px", padding: "4px 8px" }}
          >
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
};
