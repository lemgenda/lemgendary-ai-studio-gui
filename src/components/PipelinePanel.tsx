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
  const currentStepName = steps[activeStep - 1]?.name || "Ready";

  return (
    <section className="card" aria-labelledby="pipeline-panel-title">
      <div className="card-title">
        <h3 id="pipeline-panel-title" style={{ fontSize: "16px", fontWeight: 600 }}>Smart Clean Install Pipeline Orchestrator</h3>
        <span
          className={`badge ${isRunning ? "badge-warning" : "badge-info"}`}
          aria-label={`Pipeline execution state: ${isRunning ? "Active" : "Ready"}`}
        >
          {isRunning ? "PIPELINE ACTIVE" : "READY"}
        </span>
      </div>

      <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
        Executes deterministic end-to-end reconciliation across all LemGendary projects:
        hardware discovery, global toolchain verification, venv creation, manifest sync,
        safe package updates, and zero-emoji bytecode compilation.
      </p>

      <div
        role="progressbar"
        aria-valuenow={activeStep}
        aria-valuemin={0}
        aria-valuemax={7}
        aria-valuetext={isRunning ? `Step ${activeStep} of 7: ${currentStepName}` : "Pipeline ready to execute"}
        style={{ display: "flex", gap: "10px", marginBottom: "24px", flexWrap: "wrap" }}
      >
        {steps.map((s) => {
          const isCurrent = isRunning && activeStep === s.num;
          const isDone = activeStep > s.num;
          const statusBadge = isCurrent ? "badge-warning" : isDone ? "badge-success" : "badge-info";

          return (
            <div
              key={s.num}
              style={{
                flex: "1 1 120px",
                padding: "12px",
                backgroundColor: "var(--bg-secondary)",
                borderRadius: "var(--radius-sm)",
                border: isCurrent ? "1px solid var(--accent-amber)" : "1px solid var(--border-color)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  [Step {s.num}]
                </span>
                <span className={`badge ${statusBadge}`} style={{ fontSize: "9px", padding: "1px 4px" }}>
                  {isCurrent ? "RUN" : isDone ? "DONE" : "WAIT"}
                </span>
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
          aria-label={isRunning ? "Pipeline execution in progress" : "Execute Full Clean Install Pipeline across all projects"}
          aria-busy={isRunning}
        >
          {isRunning ? "Executing Pipeline..." : "Execute Full Clean Install Pipeline"}
        </button>
      </div>
    </section>
  );
};
