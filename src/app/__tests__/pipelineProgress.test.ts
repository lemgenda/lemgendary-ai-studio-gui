import { describe, expect, it } from "vitest";
import { derivePipelineProgress } from "../pipelineProgress";
import { PipelineEvent } from "../../api/types";
import { PipelineRun } from "../../store/useStudioStore";

const RUN_START = "2026-11-12T10:00:00.000Z";
const BEFORE = "2026-11-12T09:00:00.000Z";
const AFTER = "2026-11-12T10:00:05.000Z";

function stepEvent(step: number, status: PipelineEvent["status"], timestamp = AFTER, isProgress = false): PipelineEvent {
  return {
    timestamp,
    step_number: step,
    total_steps: 7,
    step_name: `Step ${step}`,
    status,
    message: `step ${step} ${status}`,
    is_progress: isProgress,
    origin: "env-manager",
  };
}

function otherEvent(origin: PipelineEvent["origin"], step = 0): PipelineEvent {
  return {
    timestamp: AFTER,
    step_number: step,
    total_steps: 1,
    step_name: "Training",
    status: "info",
    message: "epoch 3 running",
    origin,
  };
}

const full: PipelineRun = { scope: "full", startedAt: RUN_START };

describe("derivePipelineProgress", () => {
  it("ignores compiler, training and console events when finding the running step", () => {
    const events = [
      stepEvent(1, "success"),
      stepEvent(2, "info", AFTER, true),
      otherEvent("training-suite"),
      otherEvent("dataset-compiler", 3),
      otherEvent(undefined),
    ];
    const { states, activeStep } = derivePipelineProgress(events, full, true, 7);
    expect(activeStep).toBe(2);
    expect(states.slice(0, 3)).toEqual(["done", "run", "wait"]);
  });

  it("does not mark earlier steps done after a single-step run", () => {
    const run: PipelineRun = { scope: 5, startedAt: RUN_START };
    const { states, activeStep } = derivePipelineProgress([stepEvent(5, "success")], run, false, 7);
    expect(activeStep).toBe(0);
    expect(states).toEqual(["wait", "wait", "wait", "wait", "done", "wait", "wait"]);
  });

  it("shows a single-step run as running before its first event", () => {
    const run: PipelineRun = { scope: 4, startedAt: RUN_START };
    const { states, activeStep } = derivePipelineProgress([], run, true, 7);
    expect(activeStep).toBe(4);
    expect(states[3]).toBe("run");
  });

  it("keeps last known results outside a single-step run and marks failures", () => {
    const run: PipelineRun = { scope: 3, startedAt: RUN_START };
    const events = [stepEvent(1, "success", BEFORE), stepEvent(2, "error", BEFORE), stepEvent(3, "error")];
    const { states } = derivePipelineProgress(events, run, false, 7);
    expect(states.slice(0, 3)).toEqual(["done", "failed", "failed"]);
  });

  it("starts a full run with every step waiting, ignoring the previous run's events", () => {
    const events = [stepEvent(1, "success", BEFORE), stepEvent(7, "success", BEFORE)];
    const { states, activeStep } = derivePipelineProgress(events, full, true, 7);
    expect(activeStep).toBe(0);
    expect(states.every((s) => s === "wait")).toBe(true);
  });

  it("uses the event history when no run was started in this session", () => {
    const { states } = derivePipelineProgress([stepEvent(1, "success", BEFORE)], null, false, 7);
    expect(states[0]).toBe("done");
  });
});
