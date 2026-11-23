import React, { useState } from "react";
import { Modal } from "./common/Modal";
import { TabItem, TabList, TabPanel } from "./common/Tabs";
import { runDatasetTestSuite, runTrainingUnitTests, triggerUnitTestAll, UnitTestSuiteResult } from "../api/client";

type TestTab = "fleet" | "training_unit" | "dataset_unit";

const TEST_TABS: readonly TabItem<TestTab>[] = [
  { id: "fleet", label: "Fleet 1-Epoch Smoke Test", domId: "test-modal-tab-fleet" },
  { id: "training_unit", label: "Training Suite Unit Tests", domId: "test-modal-tab-training" },
  { id: "dataset_unit", label: "Dataset Compiler Tests", domId: "test-modal-tab-dataset" },
];

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
  const [activeTab, setActiveTab] = useState<TestTab>("fleet");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [output, setOutput] = useState<string | null>(null);
  const [statusState, setStatusState] = useState<"idle" | "running" | "queued" | "passed" | "failed">("idle");

  const describeFailures = (result: UnitTestSuiteResult): string => {
    const names = [...result.failures, ...result.errors];
    return names.length > 0 ? names.join(", ") : "none reported";
  };

  const handleRunFleetDiagnostic = async () => {
    setIsRunning(true);
    setStatusState("running");
    setOutput("Dispatching fleet diagnostic unit test pass across all 23 registered neural architectures (epochs=1)...");
    try {
      const res = await triggerUnitTestAll({ epochs: 1, env: "local", force: false });
      setOutput(`Fleet diagnostic job enqueued.\nJob ID: ${res.job_id}\nStatus: ${res.status}\nMessage: ${res.message}\nCheck the live telemetry stream for per-architecture results.`);
      setStatusState("queued");
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
      const data = await runTrainingUnitTests({ pattern: "test_*.py" });
      if (data.status === "passed") {
        setOutput(`[PASS] All ${data.tests_run} unit tests passed cleanly with 0 failures and 0 errors!`);
        setStatusState("passed");
      } else {
        setOutput(`[FAIL] ${data.failures_count} failures, ${data.errors_count} errors across ${data.tests_run} tests.\nFailing tests: ${describeFailures(data)}`);
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
      const data = await runDatasetTestSuite({ pattern: "test_*.py" });
      if (data.status === "passed") {
        setOutput(`[PASS] All ${data.tests_run} dataset compiler tests passed cleanly with 0 errors!`);
        setStatusState("passed");
      } else {
        setOutput(`[FAIL] ${data.failures_count} failures, ${data.errors_count} errors across ${data.tests_run} tests.\nFailing tests: ${describeFailures(data)}`);
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      id="test-modal"
      className="modal-content-medium"
      title="Test & Diagnostic Orchestrator"
      headerActions={
        <>
          <span className={`badge ${statusState === "passed" ? "badge-success" : statusState === "failed" ? "badge-error" : statusState === "running" ? "badge-warning" : statusState === "queued" ? "badge-info" : "badge-secondary"}`}>
            {statusState.toUpperCase()}
          </span>
          <button
            type="button"
            id="test-modal-btn-close"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Close test modal"
          >
            Close
          </button>
        </>
      }
    >
          <TabList
            idPrefix="test-modal"
            label="Test suites"
            items={TEST_TABS}
            value={activeTab}
            onChange={setActiveTab}
            className="modal-tablist"
            tabClassName={(selected) => `btn modal-tab-option-sm ${selected ? "btn-primary" : "btn-secondary"}`}
          />

          <TabPanel idPrefix="test-modal" items={TEST_TABS} value={activeTab}>
          {/* Description & Action */}
          <div className="modal-section-mb">
            {activeTab === "fleet" && (
              <div>
                <p className="modal-section-desc">
                  Dispatches a non-blocking 1-epoch diagnostic smoke test pass across all 23 registered neural architectures (Restoration, Classification, Forex, and Causal Assistant LLMs) to verify tensor pipelines, memory sentinels, loss calculation, and binary export.
                </p>
                <button
                  type="button"
                  id="test-modal-btn-run-fleet"
                  className="btn btn-primary btn-inline-icon"
                  onClick={handleRunFleetDiagnostic}
                  disabled={isRunning || !trainingSuiteOnline}
                >
                  {isRunning ? "Running Fleet Pass..." : "Run Fleet Diagnostic (All 23 Models)"}
                </button>
              </div>
            )}

            {activeTab === "training_unit" && (
              <div>
                <p className="modal-section-desc">
                  Runs the complete in-process unit test suite in <code>lemgendary-training-suite/tests/unit/</code> (model topologies, SOTA governor, export paths, OpenAPI 3.1 contracts, and universal causal LLM engine).
                </p>
                <button
                  type="button"
                  id="test-modal-btn-run-training-unit"
                  className="btn btn-primary btn-inline-icon"
                  onClick={handleRunTrainingUnitTests}
                  disabled={isRunning || !trainingSuiteOnline}
                >
                  {isRunning ? "Running Training Unit Tests..." : "Run Training Unit Tests"}
                </button>
              </div>
            )}

            {activeTab === "dataset_unit" && (
              <div>
                <p className="modal-section-desc">
                  Runs the test suite in <code>lemgendary-datasets/tests/</code> (knowledge ingestor, recursive chunker, QualityValidator zero-emoji enforcement, and SSOT manifest schemas).
                </p>
                <button
                  type="button"
                  id="test-modal-btn-run-dataset-unit"
                  className="btn btn-primary btn-inline-icon"
                  onClick={handleRunDatasetUnitTests}
                  disabled={isRunning || !datasetCompilerOnline}
                >
                  {isRunning ? "Running Dataset Tests..." : "Run Dataset Compiler Tests"}
                </button>
              </div>
            )}
          </div>

          {/* Console Output Display */}
          {output && (
            <div className="modal-output-section">
              <div className="modal-output-heading">
                Execution Output
              </div>
              <pre id="test-modal-output-console" className="modal-output-pre">
                {output}
              </pre>
            </div>
          )}
          </TabPanel>
    </Modal>
  );
};
