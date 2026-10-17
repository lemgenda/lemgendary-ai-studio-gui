import React from "react";
import { ValidationBanner } from "../common/ValidationBanner";
import type { DatasetItem } from "../../api/types";

export interface ScaleReductionViewProps {
  datasets: DatasetItem[];
  reduceManifold: string;
  setReduceManifold: (val: string) => void;
  reduceScale: number;
  setReduceScale: (val: number) => void;
  isReducing: boolean;
  datasetCompilerOnline: boolean;
  reduceStatus: string | null;
  onRunReduce: () => void;
}

export const ScaleReductionView: React.FC<ScaleReductionViewProps> = ({
  datasets,
  reduceManifold,
  setReduceManifold,
  reduceScale,
  setReduceScale,
  isReducing,
  datasetCompilerOnline,
  reduceStatus,
  onRunReduce,
}) => {
  return (
    <div style={{ padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
      <h4 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 6px 0", color: "var(--text-primary)" }}>
        Manifold Downsampling &amp; Scale Reduction
      </h4>
      <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 16px 0" }}>
        Synthesize a lightweight scaled derivative manifold (e.g. 25% or 10% sampling) preserving paired input/target alignments for rapid local unit testing.
      </p>

      <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px", marginBottom: "16px" }}>
        <div className="form-group">
          <label htmlFor="reduce-manifold-select" style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: "4px" }}>
            Source Manifold:
          </label>
          <select
            id="reduce-manifold-select"
            className="editor-select"
            value={reduceManifold}
            onChange={(e) => setReduceManifold(e.target.value)}
            disabled={isReducing}
            style={{ fontSize: "12px", padding: "6px 8px" }}
          >
            <option value="">Select Manifold to Reduce...</option>
            {datasets.map((d) => (
              <option key={d.key} value={d.modernized_folder || d.key}>
                {d.display_name} ({d.modernized_folder || d.key})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="reduce-scale-select" style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: "4px" }}>
            Sampling Scale Factor:
          </label>
          <select
            id="reduce-scale-select"
            className="editor-select"
            value={reduceScale}
            onChange={(e) => setReduceScale(Number(e.target.value))}
            disabled={isReducing}
            style={{ fontSize: "12px", padding: "6px 8px" }}
          >
            <option value={0.1}>10% Sampling (Diagnostic Smoke Test)</option>
            <option value={0.25}>25% Sampling (Balanced Lightweight)</option>
            <option value={0.5}>50% Sampling (Medium Scale)</option>
            <option value={0.75}>75% Sampling (High Fidelity)</option>
          </select>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary"
        onClick={onRunReduce}
        disabled={isReducing || !datasetCompilerOnline || !reduceManifold}
        style={{ fontSize: "12px", padding: "6px 14px", fontWeight: 600 }}
      >
        {isReducing ? "Executing Scale Reduction..." : "Launch Scale Reduction"}
      </button>

      {reduceStatus && (
        <ValidationBanner
          message={reduceStatus}
          style={{ marginTop: "16px", fontSize: "12px" }}
        />
      )}
    </div>
  );
};
