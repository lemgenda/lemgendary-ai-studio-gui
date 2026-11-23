import React, { useState } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { PipelineEvent } from "../api/types";
import { isTerminalEvent } from "../api/client";
import { ECOSYSTEM } from "../api/ecosystem";

export interface PipelineStepDefinition {
  num: number;
  name: string;
  shortDesc: string;
  detailedDesc: string;
}

/** Pipeline steps derived from `pipeline_steps[]` in the ecosystem snapshot. */
export const PIPELINE_STEPS: PipelineStepDefinition[] = ECOSYSTEM.pipeline_steps.map((step) => ({
  num: step.number,
  name: step.name,
  shortDesc: step.short_description,
  detailedDesc: step.long_description,
}));

interface PipelineStepCardsProps {
  isRunning: boolean;
  activeStepNum: number | null;
  onRunStep: (stepNumber: number) => Promise<void>;
  recentEvents: PipelineEvent[];
  envManagerOnline: boolean;
}

export const PipelineStepCards: React.FC<PipelineStepCardsProps> = ({
  isRunning,
  activeStepNum,
  onRunStep,
  recentEvents,
  envManagerOnline,
}) => {
  const [runningStep, setRunningStep] = useState<number | null>(null);

  const handleStepClick = async (stepNum: number) => {
    if (isRunning || runningStep !== null || !envManagerOnline) return;
    setRunningStep(stepNum);
    try {
      await onRunStep(stepNum);
    } finally {
      setRunningStep(null);
    }
  };

  // Find the latest event for each step
  const getStepLatestEvent = (stepNum: number): PipelineEvent | undefined => {
    const stepEvents = recentEvents.filter((e) => e.step_number === stepNum);
    return stepEvents.length > 0 ? stepEvents[stepEvents.length - 1] : undefined;
  };

  return (
    <div className="pipeline-steps-section">
      <div className="pipeline-steps-header">
        <div className="row-gap-md">
          <h3 className="card-heading">Individual Pipeline Step Execution</h3>
          <HelpTooltip content={`Run individual pipeline stages in isolation. Useful for diagnosing specific failures, auditing dependencies, or re-compiling bytecode without triggering the full ${PIPELINE_STEPS.length}-step pipeline.`} />
        </div>
        <span className="pipeline-steps-count">
          7 Independent Diagnostic & Reconciliation Steps
        </span>
      </div>

      <div className="pipeline-steps-grid">
        {PIPELINE_STEPS.map((step) => {
          const latestEvent = getStepLatestEvent(step.num);
          const isLatestCompleted = Boolean(latestEvent && isTerminalEvent(latestEvent));
          const isStepRunning =
            !isLatestCompleted &&
            ((isRunning && activeStepNum === step.num) || runningStep === step.num);

          let statusBadgeClass = "badge-info";
          let statusText = "READY";

          if (isStepRunning) {
            statusBadgeClass = "badge-warning";
            statusText = "RUNNING";
          } else if (latestEvent) {
            if (latestEvent.status === "success") {
              statusBadgeClass = "badge-success";
              statusText = "PASSED";
            } else if (latestEvent.status === "error") {
              statusBadgeClass = "badge-error";
              statusText = "FAILED";
            } else if (latestEvent.status === "warning") {
              statusBadgeClass = "badge-warning";
              statusText = "WARNING";
            }
          }

          return (
            <div
              key={step.num}
              className={`card pipeline-step-card ${isStepRunning ? "pipeline-step-card-running" : ""}`}
            >
              <div>
                <div className="pipeline-step-card-header">
                  <div className="row-gap-md">
                    <span className="pipeline-step-card-num">
                      [Step {step.num}]
                    </span>
                    <h4 className="pipeline-step-card-title">
                      {step.name}
                    </h4>
                  </div>
                  <div className="row-gap-sm">
                    <span className={`badge ${statusBadgeClass} badge-sm`}>
                      {statusText}
                    </span>
                    <HelpTooltip content={step.detailedDesc} position="left" />
                  </div>
                </div>

                <p className="pipeline-step-card-desc">
                  {step.shortDesc}
                </p>

                {isStepRunning && (
                  <div
                    className="pipeline-step-progress-track"
                    role="progressbar"
                    aria-label={`Step ${step.num} execution progress`}
                    aria-busy="true"
                  >
                    <div className="pipeline-step-progress-fill" />
                  </div>
                )}

                {latestEvent && (
                  <div
                    className={`pipeline-step-log ${
                      latestEvent.status === "error"
                        ? "pipeline-step-log-error"
                        : latestEvent.status === "warning"
                        ? "pipeline-step-log-warning"
                        : ""
                    }`}
                  >
                    {latestEvent.message}
                  </div>
                )}
              </div>

              <div className="pipeline-step-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-full-compact"
                  onClick={() => handleStepClick(step.num)}
                  disabled={isRunning || runningStep !== null || !envManagerOnline}
                  aria-label={`Run Step ${step.num}: ${step.name}`}
                  aria-busy={isStepRunning}
                >
                  {isStepRunning ? `Running Step ${step.num}...` : `Run Step ${step.num} Only`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
