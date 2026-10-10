import React, { useState } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { PipelineEvent } from "../api/types";

export interface PipelineStepDefinition {
  num: number;
  name: string;
  shortDesc: string;
  detailedDesc: string;
}

export const PIPELINE_STEPS: PipelineStepDefinition[] = [
  {
    num: 1,
    name: "Hardware Discovery",
    shortDesc: "Detects CUDA devices, driver levels, CPU architecture, and recommended PyTorch wheel index.",
    detailedDesc: "Performs low-level hardware probing to identify NVIDIA GPUs, CUDA capabilities, cuDNN and TensorRT libraries, and system topology to pick the optimal PyTorch distribution.",
  },
  {
    num: 2,
    name: "Toolchain Audit",
    shortDesc: "Verifies Python 3.12, Git, Node.js LTS, and toolchain prerequisites.",
    detailedDesc: "Checks foundational toolchains including active Python interpreter version, Git availability, and required build tools before running workspace transformations.",
  },
  {
    num: 3,
    name: "Virtual Environments",
    shortDesc: "Discovers and reconciles isolated .venv environments and node_modules across all projects.",
    detailedDesc: "Inspects each managed project in the workspace, validates virtual environment structures, checks interpreter binaries, and ensures node_modules directories exist.",
  },
  {
    num: 4,
    name: "Requirements Sync & Install",
    shortDesc: "Propagates centralized SSOT manifests, installs package wheels, and normalizes OpenCV.",
    detailedDesc: "Synchronizes shared dependency declarations from centralized manifests, runs deterministic pip wheel installations with accelerator indices, and pins unified OpenCV providers.",
  },
  {
    num: 5,
    name: "Dependency Audit & Upgrades",
    shortDesc: "Audits outdated packages, detects version drift, and executes dry-run dependency checks.",
    detailedDesc: "Scans installed packages against PyPI and npm registries, identifies cross-project version skew, and classifies safe non-breaking semver upgrade candidates.",
  },
  {
    num: 6,
    name: "Codebase Verification",
    shortDesc: "Compiles Python bytecode, verifies syntax, and enforces zero-emoji compliance.",
    detailedDesc: "Runs py_compile across all Python sources, validates YAML and JSON schemas, audits markdown compliance, and checks for zero emoji violations across every repository.",
  },
  {
    num: 7,
    name: "Health Matrix",
    shortDesc: "Generates complete ecosystem health report and evaluates overall system integrity.",
    detailedDesc: "Compiles complete cross-project audit matrix covering environment statuses, package counts, missing libraries, and operational health verdicts.",
  },
];

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
          <HelpTooltip content="Run individual pipeline stages in isolation. Useful for diagnosing specific failures, auditing dependencies, or re-compiling bytecode without triggering the full 7-step pipeline." />
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
          const isStepRunning = (isRunning && activeStepNum === step.num) || runningStep === step.num;
          const latestEvent = getStepLatestEvent(step.num);

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
              statusBadgeClass = "badge-danger";
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
