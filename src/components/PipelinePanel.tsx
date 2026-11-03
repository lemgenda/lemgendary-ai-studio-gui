import React, { useCallback, useState } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { CleanInstallConfirmDialog } from "./CleanInstallConfirmDialog";
import { PipelineEvent } from "../api/types";
import { PIPELINE_STEPS } from "./PipelineStepCards";

interface PipelinePanelProps {
  isRunning: boolean;
  /** `clean: true` only after the user confirmed the clean install dialog. */
  onRunPipeline: (clean: boolean) => void;
  recentEvents: PipelineEvent[];
  envManagerOnline: boolean;
}

export const PipelinePanel: React.FC<PipelinePanelProps> = ({
  isRunning,
  onRunPipeline,
  recentEvents,
  envManagerOnline,
}) => {
  const lastEvent = recentEvents[recentEvents.length - 1];
  const activeStep = lastEvent ? lastEvent.step_number : 0;
  const currentStepName = PIPELINE_STEPS[activeStep - 1]?.name || "Ready";
  const [isCleanDialogOpen, setIsCleanDialogOpen] = useState(false);
  const isDisabled = isRunning || !envManagerOnline;

  const handleCancelClean = useCallback(() => setIsCleanDialogOpen(false), []);
  const handleConfirmClean = useCallback(() => {
    setIsCleanDialogOpen(false);
    onRunPipeline(true);
  }, [onRunPipeline]);

  return (
    <section className="card" aria-labelledby="pipeline-panel-title">
      <div className="card-title">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h3 id="pipeline-panel-title" style={{ fontSize: "16px", fontWeight: 600 }}>Smart Clean Install Pipeline Orchestrator</h3>
          <HelpTooltip content={`Deterministic ${PIPELINE_STEPS.length}-step environment installation and verification pipeline. Synchronizes dependencies, creates virtual environments, audits toolchains, and eliminates version drift.`} />
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

      {/* The progressbar holds no interactive content; the step list (with help buttons) is separate. */}
      <div
        role="progressbar"
        className="sr-only"
        aria-label="Pipeline progress"
        aria-valuenow={activeStep}
        aria-valuemin={0}
        aria-valuemax={PIPELINE_STEPS.length}
        aria-valuetext={isRunning ? `Step ${activeStep} of ${PIPELINE_STEPS.length}: ${currentStepName}` : "Pipeline ready to execute"}
      />
      <ol
        aria-label="Pipeline steps"
        style={{ display: "flex", gap: "10px", flexWrap: "wrap", listStyle: "none", padding: 0, margin: "0 0 24px 0" }}
      >
        {PIPELINE_STEPS.map((s) => {
          const isCurrent = isRunning && activeStep === s.num;
          // A step is DONE if: the pipeline is still running and we're past it,
          // OR the pipeline finished and we've reached or passed this step number.
          const isDone = isRunning ? activeStep > s.num : activeStep >= s.num;
          const statusBadge = isCurrent ? "badge-warning" : isDone ? "badge-success" : "badge-info";

          return (
            <li
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
                <HelpTooltip content={`Step ${s.num}: ${s.shortDesc}`} position="top" />
              </div>
            </li>
          );
        })}
      </ol>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          id="dash-btn-run-pipeline"
          type="button"
          className="btn btn-primary"
          onClick={() => onRunPipeline(false)}
          disabled={isDisabled}
          aria-label={isRunning ? "Pipeline execution in progress" : !envManagerOnline ? "Pipeline unavailable: Environment Manager offline" : "Run the install pipeline across all projects, keeping existing environments"}
          aria-busy={isRunning}
        >
          {isRunning ? "Executing Pipeline..." : "Run Pipeline"}
        </button>
        <HelpTooltip content={`Runs the ${PIPELINE_STEPS.length}-step pipeline across all workspace projects. Non-destructive: valid virtual environments and node_modules are kept; only missing or broken ones are created.`} />
        <button
          id="pipeline-btn-clean-install"
          type="button"
          className="btn btn-danger"
          onClick={() => setIsCleanDialogOpen(true)}
          disabled={isDisabled}
          aria-haspopup="dialog"
        >
          Clean Install...
        </button>
        <HelpTooltip content="Deletes every virtual environment and node_modules folder, stops processes running from them, then reinstalls from scratch. Asks for confirmation first." />
      </div>

      <CleanInstallConfirmDialog
        isOpen={isCleanDialogOpen}
        onConfirm={handleConfirmClean}
        onCancel={handleCancelClean}
      />

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
