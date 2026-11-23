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
    <div className="compiler-subpanel">
      <h4 className="scale-reduce-title">
        Manifold Downsampling &amp; Scale Reduction
      </h4>
      <p className="scale-reduce-desc">
        Synthesize a lightweight scaled derivative manifold (e.g. 25% or 10% sampling) preserving paired input/target alignments for rapid local unit testing.
      </p>

      <div className="form-grid form-grid-reduction">
        <div className="form-group">
          <label htmlFor="reduce-manifold-select" className="form-field-label">
            Source Manifold:
          </label>
          <select
            id="reduce-manifold-select"
            className="editor-select form-control-sm"
            value={reduceManifold}
            onChange={(e) => setReduceManifold(e.target.value)}
            disabled={isReducing}
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
          <label htmlFor="reduce-scale-select" className="form-field-label">
            Sampling Scale Factor:
          </label>
          <select
            id="reduce-scale-select"
            className="editor-select form-control-sm"
            value={reduceScale}
            onChange={(e) => setReduceScale(Number(e.target.value))}
            disabled={isReducing}
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
        className="btn btn-primary btn-action-bold"
        onClick={onRunReduce}
        disabled={isReducing || !datasetCompilerOnline || !reduceManifold}
      >
        {isReducing ? "Executing Scale Reduction..." : "Launch Scale Reduction"}
      </button>

      {reduceStatus && (
        <ValidationBanner
          message={reduceStatus}
          className="banner-space-top banner-text-sm"
        />
      )}
    </div>
  );
};
