import { describe, expect, it } from "vitest";
import { FROZEN_REFUSAL_MARKER, findFrozenRefusal, parseFrozenRefusal } from "../frozenRefusal";
import { frozenRefusalHint } from "../FrozenRefusalNotice";
import { PipelineEvent, TrainingJobInfo } from "../../../api/types";

/** `FrozenSettingsChanged` text of `training/run_settings/policy.py` (canonical JSON values). */
const REFUSAL =
  `${FROZEN_REFUSAL_MARKER}model.class "UPNv2" -> "UPNv3"; optimizer {"betas":[0.9,0.999],"type":"adamw"} -> {"betas":[0.9,0.99],"type":"adamw"}. ` +
  "Start a fresh run with --clean, or accept the change with --override-frozen.";

function failedJob(error: string | null): TrainingJobInfo {
  return { id: "job-1", job_type: "train", model_key: "upn_v2", status: "failed", error_message: error };
}

function logEvent(jobId: string, message: string): PipelineEvent {
  return {
    timestamp: "2026-11-13T10:00:00Z",
    step_number: 0,
    total_steps: 1,
    step_name: "Cloud Training",
    status: "error",
    message,
    data: { job_id: jobId, job_type: "kaggle_train" },
    origin: "training-suite",
  };
}

describe("frozen settings refusal", () => {
  it("reads the message and every changed setting with its old and new value", () => {
    const refusal = parseFrozenRefusal(REFUSAL);
    expect(refusal?.message).toBe(REFUSAL);
    expect(refusal?.changes).toEqual([
      { key: "model.class", old: '"UPNv2"', new: '"UPNv3"' },
      { key: "optimizer", old: '{"betas":[0.9,0.999],"type":"adamw"}', new: '{"betas":[0.9,0.99],"type":"adamw"}' },
    ]);
  });

  it("finds the refusal inside a longer job error and a log line prefix", () => {
    const refusal = parseFrozenRefusal(`[SETTINGS] ${REFUSAL}`);
    expect(refusal?.message).toBe(REFUSAL);
    expect(parseFrozenRefusal(`Kaggle kernel ended with status error: ${REFUSAL}`)?.changes).toHaveLength(2);
  });

  it("keeps the message but lists no changes when the list has another shape", () => {
    const refusal = parseFrozenRefusal(`${FROZEN_REFUSAL_MARKER}something odd. Start a fresh run with --clean, or accept the change with --override-frozen.`);
    expect(refusal?.changes).toEqual([]);
    expect(refusal?.message).toContain("something odd");
  });

  it("ignores other text", () => {
    expect(parseFrozenRefusal("Exit code: 1")).toBeNull();
    expect(parseFrozenRefusal(null)).toBeNull();
  });

  it("takes a failed job's error first, else the newest log line of that job only", () => {
    expect(findFrozenRefusal(failedJob(REFUSAL), [])?.changes).toHaveLength(2);
    const events = [logEvent("job-other", REFUSAL), logEvent("job-1", `[SETTINGS] ${REFUSAL}`)];
    expect(findFrozenRefusal(failedJob("Kaggle kernel ended with status error"), events)?.message).toBe(REFUSAL);
    expect(findFrozenRefusal(failedJob("kernel error"), [logEvent("job-other", REFUSAL)])).toBeNull();
    expect(findFrozenRefusal({ ...failedJob(REFUSAL), status: "completed" }, [])).toBeNull();
  });

  it("points the hint at the toggle of the refused launch", () => {
    expect(frozenRefusalHint("local")).toContain("on the model card");
    expect(frozenRefusalHint("kaggle")).toContain("Cloud Training dialog");
    expect(frozenRefusalHint("local")).toContain('"Override frozen settings"');
  });
});
