import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelTrainingJob,
  fetchModels,
  fetchTrainingJob,
  isLocalTrainingEvent,
  isRemoteTrainingEvent,
  normalizeSocketMessage,
} from "../client";

/** Shape broadcast by the training-suite job manager (`training/server/jobs.py::_broadcast_log`). */
function trainingSuiteBroadcast(jobId: string, jobType: string, message: string) {
  return {
    timestamp: "2026-11-03T10:00:00",
    job_id: jobId,
    job_type: jobType,
    message,
    step_name: jobType.startsWith("kaggle") ? "Cloud Training" : "Training",
    step_number: 0,
    status: "running",
    is_progress: false,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("training-suite telemetry routing", () => {
  it("keeps job_id and job_type from training-suite broadcasts", () => {
    const ev = normalizeSocketMessage(
      trainingSuiteBroadcast("job-k1", "kaggle_train", "[PROGRESS] kernel pushed"),
      "Training",
      "training-suite",
      8200
    );
    expect(ev?.data).toEqual({ job_id: "job-k1", job_type: "kaggle_train" });
  });

  it("routes Kaggle job events to the remote stream and local jobs to the local stream", () => {
    const kaggle = normalizeSocketMessage(
      trainingSuiteBroadcast("job-k1", "kaggle_train", "Kernel running"),
      "Training",
      "training-suite"
    )!;
    const local = normalizeSocketMessage(
      trainingSuiteBroadcast("job-l1", "train", "Epoch 1 completed"),
      "Training",
      "training-suite"
    )!;

    expect(isRemoteTrainingEvent(kaggle, null)).toBe(true);
    expect(isLocalTrainingEvent(kaggle, null)).toBe(false);
    expect(isRemoteTrainingEvent(local, null)).toBe(false);
    expect(isLocalTrainingEvent(local, null)).toBe(true);
  });

  it("routes events matching the attached remote job id to the remote stream", () => {
    const ev = normalizeSocketMessage(trainingSuiteBroadcast("job-r9", "custom", "line"), "Training", "training-suite")!;
    expect(isRemoteTrainingEvent(ev, "job-r9")).toBe(true);
    expect(isLocalTrainingEvent(ev, "job-r9")).toBe(false);
    expect(isLocalTrainingEvent(ev, "other")).toBe(true);
  });

  it("never routes events from other sidecars to training streams", () => {
    const ev = normalizeSocketMessage({ chunk: "compiling shard 1" }, "Compiler", "dataset-compiler")!;
    expect(isRemoteTrainingEvent(ev, null)).toBe(false);
    expect(isLocalTrainingEvent(ev, null)).toBe(false);
  });
});

describe("training job control", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resolves when the sidecar confirms cancellation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ job_id: "j1", status: "cancelled", cancelled: true })));
    await expect(cancelTrainingJob("j1")).resolves.toMatchObject({ cancelled: true, status: "cancelled" });
  });

  it("throws with the sidecar message when the job cannot be cancelled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ job_id: "j1", status: "completed", cancelled: false, message: "Job cannot be cancelled in its current state." })
      )
    );
    await expect(cancelTrainingJob("j1")).rejects.toThrow(/cannot be cancelled.*status: completed/);
  });

  it("throws the HTTP detail when the job is unknown", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ detail: "Job 'j1' not found" }, 404))));
    await expect(cancelTrainingJob("j1")).rejects.toThrow("Job 'j1' not found");
    await expect(fetchTrainingJob("j1")).rejects.toThrow("Job 'j1' not found");
  });

  it("does not invent a spatial ladder when the sidecar omits it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          url.includes("/api/gui/models/with-stats")
            ? jsonResponse([{ key: "upn_v2", display_name: "UPN v2", architecture: "MobileNetV3", task_type: "enhance" }])
            : jsonResponse({ latest_res: null, latest_data: null, latest_epoch: null })
        )
      )
    );
    const [model] = await fetchModels();
    expect(model.spatial_ladder).toEqual([]);
    expect(model.target_res).toBeNull();
    expect(model.active_res).toBeNull();
  });
});
