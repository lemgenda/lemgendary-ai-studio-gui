import React from "react";
import { HelpTooltip } from "./HelpTooltip";
import { PipelineEvent } from "../api/types";

interface PipelinePanelProps {
  isRunning: boolean;
  onRunPipeline: () => void;
  recentEvents: PipelineEvent[];
  envManagerOnline: boolean;
}

export const PipelinePanel: React.FC<PipelinePanelProps> = ({
  isRunning,
  onRunPipeline,
  recentEvents,
  envManagerOnline,
}) => {
  const steps = [
    { num: 1, name: "Hardware Discovery", desc: "Detects CUDA devices, driver levels, CPU architecture, and recommended PyTorch wheel index." },
    { num: 2, name: "Toolchain Audit", desc: "Verifies Python 3.12, Git, Node.js LTS, and winget package manager availability." },
    { num: 3, name: "Virtual Environments", desc: "Recreates and verifies isolated .venv virtual environments across all projects." },
    { num: 4, name: "Requirements Sync & Install", desc: "Propagates centralized SSOT dependencies and installs wheels deterministically." },
    { num: 5, name: "Dependency Audit & Upgrades", desc: "Identifies cross-project package version drift and performs safe semver upgrade dry-runs." },
    { num: 6, name: "Codebase Verification", desc: "Compiles bytecode and runs full compliance checks (py_compile, linting, markdownlint)." },
    { num: 7, name: "Health Matrix", desc: "Generates final multi-project health verification matrix and publishes system state." },
  ];

  const lastEvent = recentEvents[recentEvents.length - 1];
  const activeStep = lastEvent ? lastEvent.step_number : 0;
  const currentStepName = steps[activeStep - 1]?.name || "Ready";

  return (
    <section className="card" aria-labelledby="pipeline-panel-title">
      <div className="card-title">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h3 id="pipeline-panel-title" style={{ fontSize: "16px", fontWeight: 600 }}>Smart Clean Install Pipeline Orchestrator</h3>
          <HelpTooltip content="Deterministic 7-step environment installation and verification pipeline. Synchronizes dependencies, creates virtual environments, audits toolchains, and eliminates version drift." />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            className={`badge ${isRunning ? "badge-warning" : "badge-info"}`}
            aria-label={`Pipeline execution state: ${isRunning ? "Active" : "Ready"}`}
          >
            {isRunning ? "PIPELINE ACTIVE" : "READY"}
          </span>
          <HelpTooltip content={isRunning ? "Pipeline execution is currently active across worker threads." : "Pipeline is idle and ready for execution."} />
        </div>
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
                position: "relative",
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
                <span style={{ fontSize: "12px", fontWeight: 600 }}>{s.name}</span>
                <HelpTooltip content={`Step ${s.num}: ${s.desc}`} position="top" />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onRunPipeline}
          disabled={isRunning || !envManagerOnline}
          aria-label={isRunning ? "Pipeline execution in progress" : !envManagerOnline ? "Pipeline unavailable: Environment Manager offline" : "Execute Full Clean Install Pipeline across all projects"}
          aria-busy={isRunning}
        >
          {isRunning ? "Executing Pipeline..." : "Execute Full Clean Install Pipeline"}
        </button>
        <HelpTooltip content="Initiates the 7-step clean install sequence across all workspace projects. Reclaims site-packages and installs frozen wheels from SSOT manifests." />
      </div>

      {!envManagerOnline && (
        <p
          role="alert"
          style={{ fontSize: "12px", color: "var(--accent-rose)", marginTop: "8px" }}
        >
          Environment Manager (Port 8000) is offline.
          The pipeline cannot execute until the sidecar is launched.
        </p>
      )}
    </section>
  );
};

export default PipelinePanel;
