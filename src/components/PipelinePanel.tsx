import React from "react";
import { PipelineEvent } from "../api/types";

interface PipelinePanelProps {
  isRunning: boolean;
  onRunPipeline: () => void;
  recentEvents: PipelineEvent[];
}

export const PipelinePanel: React.FC<PipelinePanelProps> = ({
  isRunning,
  onRunPipeline,
  recentEvents,
}) => {
  const steps = [
    { num: 1, name: "Hardware Discovery" },
    { num: 2, name: "Toolchain Audit" },
    { num: 3, name: "Virtual Environments" },
    { num: 4, name: "Requirements Sync & Install" },
    { num: 5, name: "Dependency Audit & Upgrades" },
    { num: 6, name: "Codebase Verification" },
    { num: 7, name: "Health Matrix" },
  ];

  const lastEvent = recentEvents[recentEvents.length - 1];
  const activeStep = lastEvent ? lastEvent.step_number : 0;

  return (
    <div className="card">
      <div className="card-title">
        <span>Smart Clean Install Pipeline Orchestrator</span>
        <span className={`badge ${isRunning ? "badge-warning" : "badge-info"}`}>
          {isRunning ? "PIPELINE ACTIVE" : "READY"}
        </span>
      </div>

      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
        Executes deterministic end-to-end reconciliation across all LemGendary projects:
        hardware discovery, global toolchain verification, venv creation, manifest sync,
        safe package updates, and zero-emoji bytecode compilation.
      </p>

      <div style={{ display: "flex", gap: "10px", marginBottom: "24px", flexWrap: "wrap" }}>
        {steps.map((s) => {
          let stepClass = "badge-info";
          let labelPrefix = `[Step ${s.num}]`;

          if (isRunning && activeStep === s.num) {
            stepClass = "badge-warning";
          } else if (activeStep > s.num) {
            stepClass = "badge-success";
          }

          return (
            <div
              key={s.num}
              style={{
                flex: "1 1 120px",
                padding: "12px",
                backgroundColor: "var(--bg-secondary)",
                borderRadius: "var(--radius-sm)",
                border: activeStep === s.num && isRunning ? "1px solid var(--accent-amber)" : "1px solid var(--border-color)",
              }}
            >
              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {labelPrefix}
              </div>
              <div style={{ fontSize: "12px", fontWeight: 600, marginTop: "4px" }}>
                {s.name}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onRunPipeline}
          disabled={isRunning}
        >
          {isRunning ? "Executing Pipeline..." : "Execute Full Clean Install Pipeline"}
        </button>
      </div>
    </div>
  );
};
