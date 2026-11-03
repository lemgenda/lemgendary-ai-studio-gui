/**
 * LemGendary AI Studio - in-process unit test suites (Training Suite and Dataset Compiler).
 */

import { DATASETS_BASE, TRAINING_BASE } from "./endpoints";
import { sidecarFetch } from "./http";
import { UnitTestSuitePayload, UnitTestSuiteResult } from "./types";

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Normalizes a sidecar unit test response so missing fields never crash the UI. */
export function normalizeUnitTestSuiteResult(data: unknown): UnitTestSuiteResult {
  const raw = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  return {
    status: typeof raw.status === "string" ? raw.status : "unknown",
    tests_run: toCount(raw.tests_run),
    failures_count: toCount(raw.failures_count),
    errors_count: toCount(raw.errors_count),
    failures: toStringList(raw.failures),
    errors: toStringList(raw.errors),
  };
}

async function postUnitTestSuite(url: string, payload: UnitTestSuitePayload, label: string): Promise<UnitTestSuiteResult> {
  const resp = await sidecarFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pattern: payload.pattern ?? "test_*.py" }),
  });
  if (!resp.ok) {
    throw new Error(`${label} returned HTTP ${resp.status}`);
  }
  return normalizeUnitTestSuiteResult(await resp.json());
}

/** Runs the Training Suite in-process unit tests (`POST /api/training/unit-test-run`). */
export async function runTrainingUnitTests(payload: UnitTestSuitePayload = {}): Promise<UnitTestSuiteResult> {
  return postUnitTestSuite(`${TRAINING_BASE}/api/training/unit-test-run`, payload, "Training Suite unit test run");
}

/** Runs the Dataset Compiler in-process test suite (`POST /api/llm/test-suite`). */
export async function runDatasetTestSuite(payload: UnitTestSuitePayload = {}): Promise<UnitTestSuiteResult> {
  return postUnitTestSuite(`${DATASETS_BASE}/api/llm/test-suite`, payload, "Dataset Compiler test suite");
}
