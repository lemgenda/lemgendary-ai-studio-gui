/**
 * LemGendary AI Studio - per-step state of the install pipeline, derived from
 * the shared event buffer.
 *
 * The buffer also holds compiler, training and studio console events (all with
 * `step_number: 0`), so only Environment Manager events with a valid step
 * number count. A step's state comes from its own latest event, not from the
 * position of the newest event, so a single-step run never marks the steps
 * before it as done.
 */

import { PipelineEvent } from "../api/types";
import { isTerminalEvent } from "../api/telemetry";
import { PipelineRun } from "../store/useStudioStore";

export type PipelineStepState = "wait" | "run" | "done" | "failed";

export interface PipelineProgress {
  /** State of steps 1..totalSteps, at index `step - 1`. */
  states: PipelineStepState[];
  /** The step currently running, or 0 when none is. */
  activeStep: number;
}

/** True for an Environment Manager pipeline event that names a real step. */
export function isPipelineStepEvent(ev: PipelineEvent, totalSteps: number): boolean {
  const fromEnvManager = ev.origin === undefined || ev.origin === "env-manager";
  return fromEnvManager && ev.step_number >= 1 && ev.step_number <= totalSteps;
}

/** True when the event was emitted at or after the run started (unparsable times count as inside). */
function isInRun(ev: PipelineEvent, run: PipelineRun): boolean {
  const evTime = Date.parse(ev.timestamp);
  const startTime = Date.parse(run.startedAt);
  if (Number.isNaN(evTime) || Number.isNaN(startTime)) return true;
  return evTime >= startTime;
}

function stateOf(latest: PipelineEvent | undefined, isRunning: boolean, isRunTarget: boolean): PipelineStepState {
  // A single-step run shows RUN from the click, before its first event arrives.
  if (!latest) return isRunning && isRunTarget ? "run" : "wait";
  if (isTerminalEvent(latest)) return latest.status === "error" ? "failed" : "done";
  return isRunning ? "run" : "wait";
}

/**
 * Per-step state for the pipeline pills and step cards.
 *
 * Steps inside the current run's scope (every step for a full run, one step
 * for a single-step run) use only events from this run, so steps not reached
 * yet show WAIT. Steps outside a single-step run keep their last known result.
 */
export function derivePipelineProgress(
  events: readonly PipelineEvent[],
  run: PipelineRun | null,
  isRunning: boolean,
  totalSteps: number,
): PipelineProgress {
  const stepEvents = events.filter((ev) => isPipelineStepEvent(ev, totalSteps));
  const latestAll = new Map<number, PipelineEvent>();
  const latestInRun = new Map<number, PipelineEvent>();
  for (const ev of stepEvents) {
    latestAll.set(ev.step_number, ev);
    if (run && isInRun(ev, run)) latestInRun.set(ev.step_number, ev);
  }

  const states: PipelineStepState[] = [];
  let activeStep = 0;
  for (let step = 1; step <= totalSteps; step++) {
    const inScope = run !== null && (run.scope === "full" || run.scope === step);
    const latest = inScope ? latestInRun.get(step) : latestAll.get(step);
    const state = stateOf(latest, isRunning && inScope, run?.scope === step);
    if (state === "run") activeStep = step;
    states.push(state);
  }
  return { states, activeStep };
}
