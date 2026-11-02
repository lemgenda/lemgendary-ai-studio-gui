import React, { useState } from "react";
import { triggerUnitTestAll } from "../api/client";
import { sidecarFetch } from "../api/http";

interface TestModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainingSuiteOnline: boolean;
  datasetCompilerOnline: boolean;
  onLogMessage?: (msg: string) => void;
}

export const TestModal: React.FC<TestModalProps> = ({
  isOpen,
  onClose,
  trainingSuiteOnline,
  datasetCompilerOnline,
  onLogMessage,
}) => {
  const [activeTab, setActiveTab] = useState<"fleet" | "training_unit" | "dataset_unit">("fleet");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [output, setOutput] = useState<string | null>(null);
  const [statusState, setStatusState] = useState<"idle" | "running" | "passed" | "failed">("idle");

  if (!isOpen) return null;

  const handleRunFleetDiagnostic = async () => {
    setIsRunning(true);
    setStatusState("running");
    setOutput("Dispatching fleet diagnostic unit test pass across all 23 registered neural architectures (epochs=1)...");
    try {
      const res = await triggerUnitTestAll({ epochs: 1, env: "local", force: false });
      setOutput(`Fleet diagnostic job enqueued successfully!\nJob ID: ${res.job_id}\nStatus: ${res.status}\nMessage: ${res.message}\nCheck live telemetry stream for per-architecture loss convergence.`);
      setStatusState("passed");
      onLogMessage?.(`Fleet diagnostic pass dispatched (Job ID: ${res.job_id})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setOutput(`Fleet diagnostic dispatch failed: ${msg}`);
      setStatusState("failed");
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunTrainingUnitTests = async () => {
    setIsRunning(true);
    setStatusState("running");
    setOutput("Executing in-process Training Suite unit tests (models, governance, export, LLM causal engine)...");
    try {
      const resp = await sidecarFetch("http://127.0.0.1:8200/api/training/unit-test-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern: "test_*.py" }),
      });
      if (!resp.ok) {
        throw new Error(`Server returned HTTP ${resp.status}`);
      }
      const data = await resp.json();
      if (data.status === "passed") {
        setOutput(`[PASS] All ${data.tests_run} unit tests passed cleanly with 0 failures and 0 errors!`);
        setStatusState("passed");
      } else {
        setOutput(`[FAIL] ${data.failures_count} failures, ${data.errors_count} errors across ${data.tests_run} tests.\nFailures: ${data.failures.join(", ")}`);
        setStatusState("failed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setOutput(`Training unit tests failed: ${msg}`);
      setStatusState("failed");
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunDatasetUnitTests = async () => {
    setIsRunning(true);
    setStatusState("running");
    setOutput("Executing in-process Dataset Compiler unit tests (tools.llm_helper, quality validator, chunker)...");
    try {
      const resp = await sidecarFetch("http://127.0.0.1:8100/api/llm/test-suite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern: "test_*.py" }),
      });
      if (!resp.ok) {
        throw new Error(`Server returned HTTP ${resp.status}`);
      }
      const data = await resp.json();
      if (data.status === "passed") {
        setOutput(`[PASS] All ${data.tests_run} dataset compiler tests passed cleanly with 0 errors!`);
        setStatusState("passed");
      } else {
        setOutput(`[FAIL] ${data.failures_count} failures, ${data.errors_count} errors across ${data.tests_run} tests.\nErrors: ${data.errors.join(", ")}`);
        setStatusState("failed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setOutput(`Dataset compiler tests failed: ${msg}`);
      setStatusState("failed");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="test-modal-title">
      <div className="modal-content" style={{ maxWidth: "760px", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h3 id="test-modal-title" style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              Test &amp; Diagnostic Orchestrator
            </h3>
            <span className={`badge ${statusState === "passed" ? "badge-success" : statusState === "failed" ? "badge-danger" : statusState === "running" ? "badge-warning" : "badge-secondary"}`}>
              {statusState.toUpperCase()}
            </span>
          </div>
          <button
            type="button"
            id="test-modal-btn-close"
            onClick={onClose}
            aria-label="Close test modal"
            style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "18px", padding: "4px" }}
          >
            X
          </button>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "18px", background: "rgba(255,255,255,0.03)", padding: "4px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
            <button
              type="button"
              id="test-modal-tab-fleet"
              className={`btn ${activeTab === "fleet" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab("fleet")}
              style={{ flex: 1, fontSize: "12px", padding: "6px 12px" }}
            >
              Fleet 1-Epoch Smoke Test
            </button>
            <button
              type="button"
              id="test-modal-tab-training"
              className={`btn ${activeTab === "training_unit" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab("training_unit")}
              style={{ flex: 1, fontSize: "12px", padding: "6px 12px" }}
            >
              Training Suite Unit Tests
            </button>
            <button
              type="button"
              id="test-modal-tab-dataset"
              className={`btn ${activeTab === "dataset_unit" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab("dataset_unit")}
              style={{ flex: 1, fontSize: "12px", padding: "6px 12px" }}
            >
              Dataset Compiler Tests
            </button>
          </div>

          {/* Description & Action */}
          <div style={{ marginBottom: "18px" }}>
            {activeTab === "fleet" && (
              <div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px", lineHeight: "1.5" }}>
                  Dispatches a non-blocking 1-epoch diagnostic smoke test pass across all 23 registered neural architectures (Restoration, Classification, Forex, and Causal Assistant LLMs) to verify tensor pipelines, memory sentinels, loss calculation, and binary export.
                </p>
                <button
                  type="button"
                  id="test-modal-btn-run-fleet"
                  className="btn btn-primary"
                  onClick={handleRunFleetDiagnostic}
                  disabled={isRunning || !trainingSuiteOnline}
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                >
                  {isRunning ? "Running Fleet Pass..." : "Run Fleet Diagnostic (All 23 Models)"}
                </button>
              </div>
            )}

            {activeTab === "training_unit" && (
              <div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px", lineHeight: "1.5" }}>
                  Runs the complete in-process unit test suite in <code>lemgendary-training-suite/tests/unit/</code> (model topologies, SOTA governor, export paths, OpenAPI 3.1 contracts, and universal causal LLM engine).
                </p>
                <button
                  type="button"
                  id="test-modal-btn-run-training-unit"
                  className="btn btn-primary"
                  onClick={handleRunTrainingUnitTests}
                  disabled={isRunning || !trainingSuiteOnline}
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                >
                  {isRunning ? "Running Training Unit Tests..." : "Run Training Unit Tests"}
                </button>
              </div>
            )}

            {activeTab === "dataset_unit" && (
              <div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px", lineHeight: "1.5" }}>
                  Runs the test suite in <code>lemgendary-datasets/tests/</code> (knowledge ingestor, recursive chunker, QualityValidator zero-emoji enforcement, and SSOT manifest schemas).
                </p>
                <button
                  type="button"
                  id="test-modal-btn-run-dataset-unit"
                  className="btn btn-primary"
                  onClick={handleRunDatasetUnitTests}
                  disabled={isRunning || !datasetCompilerOnline}
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                >
                  {isRunning ? "Running Dataset Tests..." : "Run Dataset Compiler Tests"}
                </button>
              </div>
            )}
          </div>

          {/* Console Output Display */}
          {output && (
            <div style={{ marginTop: "16px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                Execution Output
              </div>
              <pre
                id="test-modal-output-console"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  padding: "12px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  color: "var(--text-primary)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  maxHeight: "220px",
                  overflowY: "auto",
                }}
              >
                {output}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
