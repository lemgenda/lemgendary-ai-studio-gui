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
    <div style={{ marginTop: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600 }}>Individual Pipeline Step Execution</h3>
          <HelpTooltip content={`Run individual pipeline stages in isolation. Useful for diagnosing specific failures, auditing dependencies, or re-compiling bytecode without triggering the full ${PIPELINE_STEPS.length}-step pipeline.`} />
        </div>
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          7 Independent Diagnostic & Reconciliation Steps
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px",
        }}
      >
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
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "16px",
                border: isStepRunning ? "1px solid var(--accent-amber)" : "1px solid var(--border-color)",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-muted)",
                        fontWeight: 600,
                      }}
                    >
                      [Step {step.num}]
                    </span>
                    <h4 style={{ fontSize: "14px", fontWeight: 600, margin: 0 }}>
                      {step.name}
                    </h4>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      className={`badge ${statusBadgeClass}`}
                      style={{ fontSize: "10px", padding: "2px 6px" }}
                    >
                      {statusText}
                    </span>
                    <HelpTooltip content={step.detailedDesc} position="left" />
                  </div>
                </div>

                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                    marginBottom: "12px",
                  }}
                >
                  {step.shortDesc}
                </p>

                {isStepRunning && (
                  <div
                    style={{
                      marginBottom: "10px",
                      position: "relative",
                      height: "5px",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      overflow: "hidden",
                    }}
                    role="progressbar"
                    aria-label={`Step ${step.num} execution progress`}
                    aria-busy="true"
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        width: "50%",
                        background: "linear-gradient(90deg, #f59e0b 0%, #ffd166 60%, #00f0ff 100%)",
                        borderRadius: "9999px",
                        boxShadow: "0 0 8px rgba(255, 209, 102, 0.5)",
                        animation: "telemetry-indeterminate-sweep 1.8s infinite ease-in-out",
                      }}
                    />
                  </div>
                )}

                {latestEvent && (
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      marginBottom: "14px",
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      color:
                        latestEvent.status === "error"
                          ? "var(--accent-rose)"
                          : latestEvent.status === "warning"
                          ? "var(--accent-amber)"
                          : "var(--text-secondary)",
                      maxHeight: "60px",
                      overflowY: "auto",
                      wordBreak: "break-word",
                    }}
                  >
                    {latestEvent.message}
                  </div>
                )}
              </div>

              <div style={{ paddingTop: "8px", borderTop: "1px solid var(--border-color)" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleStepClick(step.num)}
                  disabled={isRunning || runningStep !== null || !envManagerOnline}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "12px",
                    padding: "7px 12px",
                  }}
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
