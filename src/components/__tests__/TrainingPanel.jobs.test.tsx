// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrainingPanel } from "../TrainingPanel";
import { useStudioStore } from "../../store/useStudioStore";
import { FALLBACK_MODELS } from "../training/fallbackModels";
import { ModelItem, PipelineEvent, TrainingJobInfo } from "../../api/types";
import * as client from "../../api/client";

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
  spatial_ladder: [256, 384, 512, 640],
  target_res: 640,
  active_res: 384,
};

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
    port: 8200,
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
    await act(async () => {
      root.render(<TrainingPanel trainingSuiteOnline={props.online} recentEvents={props.events ?? []} />);
    });
    await flush();
  };

  beforeEach(() => {
    useStudioStore.setState({
      cachedModels: [],
      localJob: { jobId: null, modelKey: null },
      remoteJob: { jobId: null, modelKey: null },
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

  it("never writes offline placeholders into the store cache", async () => {
    await render({ online: false });
    expect(mocked.fetchModels).toHaveBeenCalledTimes(1);
    expect(useStudioStore.getState().cachedModels).toEqual([]);
    expect(container.textContent).toContain("offline placeholders");
    expect(container.textContent).toContain("UNKNOWN (OFFLINE)");
    expect(container.textContent).toContain(FALLBACK_MODELS[0].display_name);
  });

  it("refetches the model registry when the sidecar comes back online", async () => {
    await render({ online: false });
    expect(mocked.fetchModels).toHaveBeenCalledTimes(1);

    mocked.fetchModels.mockResolvedValue([LIVE_MODEL]);
    await render({ online: true });

    expect(mocked.fetchModels).toHaveBeenCalledTimes(2);
    expect(useStudioStore.getState().cachedModels).toEqual([LIVE_MODEL]);
    expect(container.textContent).toContain("UPN v2 (live)");
    expect(container.textContent).not.toContain("UNKNOWN (OFFLINE)");
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
