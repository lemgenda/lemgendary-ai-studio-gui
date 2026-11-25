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
  onRunPipeline?: (clean: boolean) => Promise<void> | void;
  onRunCustomPipeline?: (stepNumbers: number[]) => Promise<void> | void;
  recentEvents: PipelineEvent[];
  envManagerOnline: boolean;
}

export const PipelineStepCards: React.FC<PipelineStepCardsProps> = ({
  isRunning,
  activeStepNum,
  onRunStep,
  onRunPipeline,
  onRunCustomPipeline,
  recentEvents,
  envManagerOnline,
}) => {
  const [runningStep, setRunningStep] = useState<number | null>(null);
  const [selectedSteps, setSelectedSteps] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);

  const toggleStepSelection = (stepNum: number) => {
    setSelectedSteps((prev) =>
      prev.includes(stepNum) ? prev.filter((n) => n !== stepNum) : [...prev, stepNum].sort((a, b) => a - b),
    );
  };

  const handleStepClick = async (stepNum: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning || runningStep !== null || !envManagerOnline) return;
    setRunningStep(stepNum);
    try {
      await onRunStep(stepNum);
    } finally {
      setRunningStep(null);
    }
  };

  const handleRunCustom = async () => {
    if (isRunning || selectedSteps.length === 0 || !envManagerOnline) return;
    if (onRunCustomPipeline) {
      await onRunCustomPipeline(selectedSteps);
    } else {
      // Default fallback: execute selected steps sequentially
      for (const stepNum of selectedSteps) {
        await onRunStep(stepNum);
      }
    }
  };

  const handleRunEntire = () => {
    if (isRunning || !envManagerOnline) return;
    if (onRunPipeline) {
      onRunPipeline(false);
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
          <h3 className="card-heading">Custom Pipeline and Individual Step Execution</h3>
          <HelpTooltip
            content="Click any step card to select or deselect it for a custom pipeline run, or click 'Run Step X Only' to execute an individual stage in isolation."
          />
        </div>
        <span className="pipeline-steps-count">
          {selectedSteps.length} of 7 Steps Selected
        </span>
      </div>

      <div className="pipeline-steps-grid">
        {PIPELINE_STEPS.map((step) => {
          const latestEvent = getStepLatestEvent(step.num);
          const isLatestCompleted = Boolean(latestEvent && isTerminalEvent(latestEvent));
          const isStepRunning =
            !isLatestCompleted &&
            ((isRunning && activeStepNum === step.num) || runningStep === step.num);
          const isSelected = selectedSteps.includes(step.num);

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
              tabIndex={0}
              role="button"
              aria-pressed={isSelected}
              aria-label={`Step ${step.num}: ${step.name}. ${isSelected ? "Selected" : "Not selected"}. Click to toggle selection.`}
              className={`card pipeline-step-card ${isStepRunning ? "pipeline-step-card-running" : ""} ${isSelected ? "pipeline-step-card-selected" : ""}`}
              onClick={() => toggleStepSelection(step.num)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleStepSelection(step.num);
                }
              }}
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
                  onClick={(e) => handleStepClick(step.num, e)}
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

        {/* 8th Action Card: Custom and Entire Pipeline Execution */}
        <div className="card pipeline-action-slot-card" role="region" aria-label="Pipeline Execution Actions">
          <h4 className="pipeline-action-slot-title">Pipeline Execution</h4>
          <button
            id="pipeline-btn-run-custom"
            type="button"
            className="btn btn-primary pipeline-action-btn-custom"
            onClick={handleRunCustom}
            disabled={isRunning || selectedSteps.length === 0 || !envManagerOnline}
            title={selectedSteps.length === 0 ? "Select at least one step card to execute" : `Execute ${selectedSteps.length} selected steps sequentially`}
          >
            {isRunning ? "Running Pipeline..." : "Run Custom Pipeline"}
          </button>
          <button
            id="pipeline-btn-run-entire"
            type="button"
            className="btn btn-secondary pipeline-action-btn-full"
            onClick={handleRunEntire}
            disabled={isRunning || !envManagerOnline}
            title="Execute all 7 pipeline steps sequentially"
          >
            Run Entire Pipeline
          </button>
        </div>
      </div>
    </div>
  );
};
