// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrainingPanel } from "../TrainingPanel";
import { NO_TRANSFER_JOB, useStudioStore } from "../../store/useStudioStore";
import { ModelItem, PipelineEvent, TrainingJobInfo } from "../../api/types";
import { servicePort } from "../../api/config";
import * as client from "../../api/client";
import { FROZEN_REFUSAL_MARKER } from "../training/frozenRefusal";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    fetchModels: vi.fn(),
    cancelTrainingJob: vi.fn(),
    fetchTrainingJob: vi.fn(),
    fetchRunningTrainingJobs: vi.fn(),
    fetchKaggleSuiteStatus: vi.fn(),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocked = vi.mocked(client);

const LIVE_MODEL: ModelItem = {
  key: "upn_v2",
  display_name: "UPN v2 (live)",
  architecture: "MobileNetV3-Small Parameter Regressor",
  task_type: "enhance",
  training_status: "partially_trained",
  is_fully_trained: false,
  spatial_ladder: [256, 384, 512, 640],
  target_res: 640,
  active_res: 384,
};

/** `FrozenSettingsChanged` text of the Training Suite (`training/run_settings/policy.py`). */
const FROZEN_REFUSAL =
  `${FROZEN_REFUSAL_MARKER}model.class "UPNv2" -> "UPNv3". ` +
  "Start a fresh run with --clean, or accept the change with --override-frozen.";

function runningJob(status: string): TrainingJobInfo {
  return { id: "job-local-1", job_type: "train", model_key: "upn_v2", status };
}

function trainingEvent(jobId: string, jobType: string, message: string): PipelineEvent {
  return {
    timestamp: new Date(Date.now() + 1000).toISOString(),
    step_number: 0,
    total_steps: 1,
    step_name: jobType.startsWith("kaggle") ? "Cloud Training" : "Training",
    status: "info",
    message,
    data: { job_id: jobId, job_type: jobType },
    origin: "training-suite",
    port: servicePort("training-suite"),
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("TrainingPanel job lifecycle and telemetry routing", () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = async (props: { online: boolean; events?: PipelineEvent[] }) => {
    useStudioStore.setState({ events: props.events ?? [] });
    await act(async () => {
      root.render(<TrainingPanel trainingSuiteOnline={props.online} />);
    });
    await flush();
  };

  beforeEach(() => {
    useStudioStore.setState({
      cachedModels: [],
      localJob: { jobId: null, modelKey: null },
      remoteJob: { jobId: null, modelKey: null },
      transferJob: NO_TRANSFER_JOB,
    });
    mocked.fetchModels.mockResolvedValue([]);
    mocked.fetchRunningTrainingJobs.mockResolvedValue([]);
    mocked.fetchKaggleSuiteStatus.mockResolvedValue({} as Awaited<ReturnType<typeof client.fetchKaggleSuiteStatus>>);
    mocked.fetchTrainingJob.mockResolvedValue(runningJob("running"));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("shows an empty offline state instead of a fake catalog", async () => {
    await render({ online: false });
    expect(mocked.fetchModels).toHaveBeenCalledTimes(1);
    expect(useStudioStore.getState().cachedModels).toEqual([]);
    expect(container.querySelector('[data-testid="models-empty-state"]')).not.toBeNull();
    expect(container.textContent).toContain("Training Suite sidecar is offline");
    expect(container.querySelectorAll(".card-grid .card")).toHaveLength(0);
  });

  it("gives the telemetry console tabs their registry IDs", async () => {
    await render({ online: false });
    for (const id of ["training-telemetry-tabs-tab-local", "training-telemetry-tabs-tab-remote", "training-telemetry-tabs-tab-system"]) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it("refetches the model registry when the sidecar comes back online", async () => {
    await render({ online: false });
    expect(mocked.fetchModels).toHaveBeenCalledTimes(1);

    mocked.fetchModels.mockResolvedValue([LIVE_MODEL]);
    await render({ online: true });

    expect(mocked.fetchModels).toHaveBeenCalledTimes(2);
    expect(useStudioStore.getState().cachedModels).toEqual([LIVE_MODEL]);
    expect(container.textContent).toContain("UPN v2 (live)");
    expect(container.querySelector('[data-testid="models-empty-state"]')).toBeNull();
  });

  it("shows an error and keeps the local job when the cancel fails", async () => {
    useStudioStore.setState({ cachedModels: [LIVE_MODEL], localJob: { jobId: "job-local-1", modelKey: "upn_v2" } });
    mocked.cancelTrainingJob.mockRejectedValue(new Error("Job cannot be cancelled in its current state. (status: running)"));
    await render({ online: true });

    const haltButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Halt Local Job");
    expect(haltButton).toBeDefined();
    await act(async () => {
      haltButton!.click();
    });
    await flush();

    expect(mocked.cancelTrainingJob).toHaveBeenCalledWith("job-local-1");
    const alert = container.querySelector('[role="alert"]');
    expect(container.textContent).toContain("Failed to stop job job-local-1: Job cannot be cancelled");
    expect(alert).not.toBeNull();
    expect(useStudioStore.getState().localJob).toEqual({ jobId: "job-local-1", modelKey: "upn_v2" });
  });

  it("clears the local job when the sidecar confirms cancellation", async () => {
    useStudioStore.setState({ cachedModels: [LIVE_MODEL], localJob: { jobId: "job-local-1", modelKey: "upn_v2" } });
    mocked.cancelTrainingJob.mockResolvedValue({ job_id: "job-local-1", status: "cancelled", cancelled: true });
    await render({ online: true });

    const haltButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Halt Local Job");
    await act(async () => {
      haltButton!.click();
    });
    await flush();

    expect(useStudioStore.getState().localJob).toEqual({ jobId: null, modelKey: null });
  });

  it("clears the local job when the sidecar reports it completed", async () => {
    vi.useFakeTimers();
    useStudioStore.setState({ cachedModels: [LIVE_MODEL], localJob: { jobId: "job-local-1", modelKey: "upn_v2" } });
    await render({ online: true });

    mocked.fetchTrainingJob.mockResolvedValue(runningJob("completed"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(mocked.fetchTrainingJob).toHaveBeenCalledWith("job-local-1");
    expect(useStudioStore.getState().localJob).toEqual({ jobId: null, modelKey: null });
    expect(container.textContent).toContain("Local training job job-local-1 completed.");
  });

  it("restores a running Kaggle job into the remote job on mount", async () => {
    mocked.fetchRunningTrainingJobs.mockResolvedValue([
      { id: "job-kaggle-9", job_type: "kaggle_train", model_key: "upn_v2", status: "running" },
      { id: "job-push-1", job_type: "kaggle_push", model_key: "upn_v2", status: "running" },
    ]);
    await render({ online: true });
    expect(useStudioStore.getState().remoteJob).toEqual({ jobId: "job-kaggle-9", modelKey: "upn_v2" });
    expect(useStudioStore.getState().localJob).toEqual({ jobId: null, modelKey: null });
  });

  it("clears the remote job when the sidecar reports it failed", async () => {
    vi.useFakeTimers();
    useStudioStore.setState({ cachedModels: [LIVE_MODEL], remoteJob: { jobId: "job-kaggle-7", modelKey: "upn_v2" } });
    await render({ online: true });

    mocked.fetchTrainingJob.mockResolvedValue({
      id: "job-kaggle-7",
      job_type: "kaggle_train",
      model_key: "upn_v2",
      status: "failed",
      error_message: "kernel error",
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(mocked.fetchTrainingJob).toHaveBeenCalledWith("job-kaggle-7");
    expect(useStudioStore.getState().remoteJob).toEqual({ jobId: null, modelKey: null });
    expect(container.textContent).toContain("Cloud training job job-kaggle-7 failed: kernel error");
  });

  it("shows a local frozen settings refusal with the changed settings and the toggle hint", async () => {
    vi.useFakeTimers();
    useStudioStore.setState({ cachedModels: [LIVE_MODEL], localJob: { jobId: "job-local-1", modelKey: "upn_v2" } });
    await render({ online: true });

    mocked.fetchTrainingJob.mockResolvedValue({ ...runningJob("failed"), error_message: FROZEN_REFUSAL });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    const region = document.getElementById("train-frozen-refusal");
    expect(region?.getAttribute("role")).toBe("alert");
    expect(region?.textContent).toContain("Local training job job-local-1 failed: resume refused because frozen run settings changed.");
    expect(document.getElementById("train-frozen-refusal-message")?.textContent).toBe(FROZEN_REFUSAL);
    const rows = Array.from(document.querySelectorAll("#train-frozen-refusal-changes tbody tr")).map((tr) =>
      Array.from(tr.querySelectorAll("td")).map((td) => td.textContent)
    );
    expect(rows).toEqual([["model.class", '"UPNv2"', '"UPNv3"']]);
    expect(document.getElementById("train-frozen-refusal-hint")?.textContent).toContain('"Override frozen settings" on the model card');
    // The refusal replaces the generic failure banner.
    expect(container.textContent).not.toContain("Local training job job-local-1 failed: Resume refused");

    await act(async () => {
      document.getElementById("train-btn-frozen-refusal-dismiss")?.click();
    });
    expect(document.getElementById("train-frozen-refusal")).toBeNull();
  });

  it("finds a Kaggle frozen settings refusal in the job log and points at the launch options", async () => {
    vi.useFakeTimers();
    useStudioStore.setState({ cachedModels: [LIVE_MODEL], remoteJob: { jobId: "job-kaggle-8", modelKey: "upn_v2" } });
    await render({ online: true, events: [trainingEvent("job-kaggle-8", "kaggle_train", `[SETTINGS] ${FROZEN_REFUSAL}`)] });

    mocked.fetchTrainingJob.mockResolvedValue({
      id: "job-kaggle-8",
      job_type: "kaggle_train",
      model_key: "upn_v2",
      status: "failed",
      error_message: "Kaggle kernel ended with status error",
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(document.getElementById("train-frozen-refusal")?.textContent).toContain("Cloud training job job-kaggle-8 failed");
    expect(document.getElementById("train-frozen-refusal-hint")?.textContent).toContain("Cloud Training dialog");
  });

  it("restores a running card Push / Pull job into the transfer job on mount", async () => {
    mocked.fetchRunningTrainingJobs.mockResolvedValue([
      { id: "job-pull-3", job_type: "kaggle_pull", model_key: "upn_v2", status: "running" },
    ]);
    await render({ online: true });
    expect(useStudioStore.getState().transferJob).toEqual({ jobId: "job-pull-3", modelKey: "upn_v2", jobType: "kaggle_pull" });
    expect(useStudioStore.getState().remoteJob).toEqual({ jobId: null, modelKey: null });
  });

  it("shows unchanged variations of a finished card push in the banner", async () => {
    vi.useFakeTimers();
    useStudioStore.setState({
      cachedModels: [LIVE_MODEL],
      transferJob: { jobId: "job-push-4", modelKey: "upn_v2", jobType: "kaggle_push" },
    });
    await render({ online: true });

    mocked.fetchTrainingJob.mockResolvedValue({
      id: "job-push-4",
      job_type: "kaggle_push",
      model_key: "upn_v2",
      status: "completed",
      metrics: { variations: { "pytorch/default": { success: true, skipped: true }, "onnx/fp16": { success: true, skipped: false } } },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(useStudioStore.getState().transferJob).toEqual(NO_TRANSFER_JOB);
    expect(container.textContent).toContain("Kaggle push job job-push-4 completed.");
    expect(container.textContent).toContain("pytorch/default: unchanged, no new version.");
  });

  it("shows a failed page sync of a card push as an error banner", async () => {
    vi.useFakeTimers();
    useStudioStore.setState({
      cachedModels: [LIVE_MODEL],
      transferJob: { jobId: "job-push-5", modelKey: "upn_v2", jobType: "kaggle_push" },
    });
    await render({ online: true });

    mocked.fetchTrainingJob.mockResolvedValue({
      id: "job-push-5",
      job_type: "kaggle_push",
      model_key: "upn_v2",
      status: "failed",
      error_message: "Model page metadata sync failed; nothing uploaded: HTTP 403",
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Kaggle push job job-push-5 failed: Model page metadata sync failed");
  });

  it("loads once on mount; caching the fetched models does not re-run the load (D11)", async () => {
    mocked.fetchModels.mockResolvedValue([LIVE_MODEL]);
    await render({ online: true });
    expect(useStudioStore.getState().cachedModels).toEqual([LIVE_MODEL]);
    expect(mocked.fetchModels).toHaveBeenCalledTimes(1);
    expect(mocked.fetchKaggleSuiteStatus).toHaveBeenCalledTimes(1);
  });

  it("routes Kaggle job events to the Remote Cloud stream and keeps local events local", async () => {
    useStudioStore.setState({ cachedModels: [LIVE_MODEL], remoteJob: { jobId: "job-kaggle-7", modelKey: "upn_v2" } });
    const events = [
      trainingEvent("job-kaggle-7", "kaggle_train", "Kaggle kernel status: running"),
      trainingEvent("job-local-2", "train", "Epoch 3 completed locally"),
    ];
    await render({ online: true, events });

    // Local tab is active by default
    expect(container.textContent).toContain("Epoch 3 completed locally");
    expect(container.textContent).not.toContain("Kaggle kernel status: running");

    const remoteTab = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("Remote Cloud")
    );
    await act(async () => {
      remoteTab!.click();
    });

    expect(container.textContent).toContain("Kaggle kernel status: running");
    expect(container.textContent).not.toContain("Epoch 3 completed locally");
  });
});
