// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelActionDeps, useModelActions } from "../useModelActions";
import * as client from "../../../api/client";

vi.mock("../../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../api/client")>();
  return {
    ...actual,
    pushKaggleModelArtifacts: vi.fn(),
    pullKaggleModelArtifacts: vi.fn(),
    generateModelDocs: vi.fn(),
    launchKaggleTrain: vi.fn(),
    monitorKaggleKernel: vi.fn(),
    blendModelSoup: vi.fn(),
    trainLLM: vi.fn(),
    triggerQuickTrain: vi.fn(),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocked = vi.mocked(client);

type Actions = ReturnType<typeof useModelActions>;

describe("useModelActions status routing", () => {
  let container: HTMLDivElement;
  let root: Root;
  let actions: Actions | null;
  let deps: ModelActionDeps;

  const Harness = ({ hookDeps }: { hookDeps: ModelActionDeps }) => {
    actions = useModelActions(hookDeps);
    return null;
  };

  const lastCall = (fn: unknown): unknown => {
    const calls = vi.mocked(fn as (m: string | null) => void).mock.calls;
    return calls[calls.length - 1]?.[0];
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    actions = null;
    deps = {
      localJob: { jobId: null, modelKey: null },
      setLocalJob: vi.fn(),
      setRemoteJob: vi.fn(),
      setTransferJob: vi.fn(),
      setActiveTelemetryTab: vi.fn(),
      setStatusNotice: vi.fn(),
      setStatusError: vi.fn(),
      loadTrainingData: vi.fn(async () => undefined),
      loadKaggleData: vi.fn(async () => undefined),
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<Harness hookDeps={deps} />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("sends a failed action to the error banner and clears the notice", async () => {
    mocked.pushKaggleModelArtifacts.mockRejectedValue(new Error("boom"));
    await act(async () => {
      await actions?.handlePushArtifacts("upn_v2");
    });
    expect(lastCall(deps.setStatusError)).toBe("Failed pushing artifacts for upn_v2: boom");
    expect(lastCall(deps.setStatusNotice)).toBeNull();
  });

  it("shows a Kaggle push on the Remote Cloud console", async () => {
    mocked.pushKaggleModelArtifacts.mockResolvedValue({ job_id: "job-p1", status: "pending", model: "upn_v2", message: "queued" });
    await act(async () => {
      await actions?.handlePushArtifacts("upn_v2");
    });
    expect(deps.setActiveTelemetryTab).toHaveBeenCalledWith("remote");
    expect(deps.setActiveTelemetryTab).not.toHaveBeenCalledWith("local");
    expect(lastCall(deps.setStatusNotice)).toContain("Remote Cloud telemetry streaming");
  });

  it("sends a successful action to the notice banner and clears an old error", async () => {
    mocked.generateModelDocs.mockResolvedValue({
      status: "success",
      model_key: "upn_v2",
      readme_path: "README.md",
      metadata_path: "model-metadata.json",
    });
    await act(async () => {
      await actions?.handleGenerateDocs("upn_v2");
    });
    expect(deps.setStatusError).toHaveBeenCalledWith(null);
    expect(lastCall(deps.setStatusError)).toBeNull();
    expect(lastCall(deps.setStatusNotice)).toBe("Regenerated README.md and model-metadata.json for upn_v2.");
  });

  it("reports a failed Kaggle dispatch as an error and still rethrows", async () => {
    mocked.launchKaggleTrain.mockRejectedValue(new Error("no quota"));
    let thrown: unknown = null;
    await act(async () => {
      try {
        await actions?.handleLaunchKaggle("upn_v2", { accelerator: "gpu-t4x2", autoPull: false, pollInterval: 30, autoResume: false, maxResumes: null, overrideFrozen: false, advanced: {} });
      } catch (err: unknown) {
        thrown = err;
      }
    });
    expect(thrown).toBeInstanceOf(Error);
    expect(lastCall(deps.setStatusError)).toBe("Failed to dispatch Kaggle training: no quota");
  });

  it("sends the accelerator id and poll interval, never gpu or credentials", async () => {
    mocked.launchKaggleTrain.mockResolvedValue({
      job_id: "job-k1",
      status: "pending",
      message: "Kaggle Cloud training queued for upn_v2 (accelerator: TPU v5e-8)",
      model: "upn_v2",
    });
    await act(async () => {
      await actions?.handleLaunchKaggle("upn_v2", { accelerator: "tpu-v5e8", autoPull: true, pollInterval: 45, autoResume: true, maxResumes: 2, overrideFrozen: true, advanced: {} });
    });
    expect(mocked.launchKaggleTrain).toHaveBeenCalledWith({
      model: "upn_v2",
      accelerator: "tpu-v5e8",
      auto_pull: true,
      poll_interval: 45,
      auto_resume: true,
      max_resumes: 2,
      override_frozen: true,
    });
    expect(lastCall(deps.setStatusNotice)).toContain("accelerator: TPU v5e-8");
  });

  it("tracks a monitored Kaggle kernel as the remote job", async () => {
    mocked.monitorKaggleKernel.mockResolvedValue({
      job_id: "job-7",
      status: "running",
      message: "attached",
      kernel_slug: "owner/upn-train",
    });
    await act(async () => {
      await actions?.handleMonitorKaggle("owner/upn-train", "upn_v2", { autoPull: true, pollInterval: 60 });
    });
    expect(mocked.monitorKaggleKernel).toHaveBeenCalledWith({
      kernel_slug: "owner/upn-train",
      model: "upn_v2",
      auto_pull: true,
      poll_interval: 60,
    });
    expect(deps.setRemoteJob).toHaveBeenCalledWith({ jobId: "job-7", modelKey: "upn_v2" });
    expect(deps.setActiveTelemetryTab).toHaveBeenCalledWith("remote");
    expect(lastCall(deps.setStatusNotice)).toContain("Monitoring Kaggle kernel owner/upn-train");
  });

  it("leaves max_resumes out when the form keeps the config default", async () => {
    mocked.launchKaggleTrain.mockResolvedValue({ job_id: "job-k2", status: "pending", message: "queued", model: "upn_v2" });
    await act(async () => {
      await actions?.handleLaunchKaggle("upn_v2", { accelerator: "cpu", autoPull: true, pollInterval: 30, autoResume: false, maxResumes: null, overrideFrozen: false, advanced: {} });
    });
    expect(mocked.launchKaggleTrain).toHaveBeenCalledWith({
      model: "upn_v2",
      accelerator: "cpu",
      auto_pull: true,
      poll_interval: 30,
      auto_resume: false,
      max_resumes: undefined,
      override_frozen: false,
    });
  });

  it("forwards the advanced clone refs and session window into the launch payload", async () => {
    mocked.launchKaggleTrain.mockResolvedValue({ job_id: "job-k3", status: "pending", message: "queued", model: "upn_v2" });
    const advanced = { git_ref: "fix/review-remediation", env_manager_ref: "main", limit_hours: 11.5, margin_minutes: 20 };
    await act(async () => {
      await actions?.handleLaunchKaggle("upn_v2", { accelerator: "cpu", autoPull: true, pollInterval: 30, autoResume: false, maxResumes: null, overrideFrozen: false, advanced });
    });
    expect(mocked.launchKaggleTrain).toHaveBeenCalledWith(expect.objectContaining(advanced));
  });

  it("leaves the advanced fields out of the payload when none is set", async () => {
    mocked.launchKaggleTrain.mockResolvedValue({ job_id: "job-k4", status: "pending", message: "queued", model: "upn_v2" });
    await act(async () => {
      await actions?.handleLaunchKaggle("upn_v2", { accelerator: "cpu", autoPull: true, pollInterval: 30, autoResume: false, maxResumes: null, overrideFrozen: false, advanced: {} });
    });
    const sent = Object.keys(mocked.launchKaggleTrain.mock.calls[0][0]);
    for (const field of ["git_ref", "env_manager_ref", "limit_hours", "margin_minutes"]) {
      expect(sent).not.toContain(field);
    }
  });

  it("tracks card Push and Pull jobs so their outcome reaches the banner", async () => {
    mocked.pushKaggleModelArtifacts.mockResolvedValue({ job_id: "job-push-1", status: "pending", model: "upn_v2", message: "queued" });
    mocked.pullKaggleModelArtifacts.mockResolvedValue({ job_id: "job-pull-1", status: "pending", model: "upn_v2", message: "queued" });
    await act(async () => {
      await actions?.handlePushArtifacts("upn_v2");
    });
    expect(deps.setTransferJob).toHaveBeenCalledWith({ jobId: "job-push-1", modelKey: "upn_v2", jobType: "kaggle_push" });
    await act(async () => {
      await actions?.handlePullArtifacts("upn_v2");
    });
    expect(deps.setTransferJob).toHaveBeenCalledWith({ jobId: "job-pull-1", modelKey: "upn_v2", jobType: "kaggle_pull" });
    expect(deps.setRemoteJob).not.toHaveBeenCalled();
  });

  it("reports a blended model soup and refreshes the catalog", async () => {
    mocked.blendModelSoup.mockResolvedValue({
      model_key: "upn_v2",
      success: true,
      soup_checkpoint: "checkpoints/upn_v2_soup.pth",
      donors: ["a.pth", "b.pth"],
      weights: [0.5, 0.5],
    });
    await act(async () => {
      await actions?.handleBlendSoup("upn_v2", null);
    });
    expect(mocked.blendModelSoup).toHaveBeenCalledWith("upn_v2", undefined);
    expect(lastCall(deps.setStatusNotice)).toBe("Blended model soup for upn_v2 from 2 checkpoint(s): checkpoints/upn_v2_soup.pth.");
    expect(deps.loadTrainingData).toHaveBeenCalled();
  });

  it("sends a failed soup blend to the error banner", async () => {
    mocked.blendModelSoup.mockRejectedValue(new Error("fewer than two checkpoints"));
    await act(async () => {
      await actions?.handleBlendSoup("upn_v2", { donors: ["psnr", "lpips"], weights: [0.75, 0.25] });
    });
    expect(mocked.blendModelSoup).toHaveBeenCalledWith("upn_v2", { donors: ["psnr", "lpips"], weights: [0.75, 0.25] });
    expect(lastCall(deps.setStatusError)).toBe("Failed to blend model soup for upn_v2: fewer than two checkpoints");
    expect(lastCall(deps.setStatusNotice)).toBeNull();
  });
  it("trains an assistant LLM through the QLoRA route and a vision model through quick-train", async () => {
    mocked.trainLLM.mockResolvedValue({ job_id: "job-llm", status: "pending", message: "queued" });
    mocked.triggerQuickTrain.mockResolvedValue({ status: "pending", job_id: "job-q" });
    const llm = { key: "ai_helper_lemgend", display_name: "AI Helper", architecture: "LLM", task_type: "llm", is_llm: true, is_fully_trained: false, training_status: "initializing" as const };
    const vision = { ...llm, key: "upn_v2", display_name: "UPN v2", is_llm: false };
    await act(async () => {
      await actions?.handleStartLocalTrain(llm, { batchSize: 2, overrideFrozen: true });
    });
    expect(mocked.trainLLM).toHaveBeenCalledWith({ model: "ai_helper_lemgend", batch_size: 2, env: "local" });
    expect(mocked.triggerQuickTrain).not.toHaveBeenCalled();
    expect(deps.setLocalJob).toHaveBeenCalledWith({ jobId: "job-llm", modelKey: "ai_helper_lemgend" });
    expect(lastCall(deps.setStatusNotice)).toContain("QLoRA instruction tuning initialized");

    await act(async () => {
      await actions?.handleStartLocalTrain(vision, { batchSize: 8, overrideFrozen: false });
    });
    expect(mocked.triggerQuickTrain).toHaveBeenCalledWith({ model_key: "upn_v2", batch_size: 8, override_frozen: false });
    expect(mocked.trainLLM).toHaveBeenCalledTimes(1);
  });

  it("forwards the frozen settings override of a local launch to quick-train", async () => {
    mocked.triggerQuickTrain.mockResolvedValue({ status: "pending", job_id: "job-q2" });
    const vision = { key: "upn_v2", display_name: "UPN v2", architecture: "MobileNetV3", task_type: "enhance", is_fully_trained: false, training_status: "partially_trained" as const };
    await act(async () => {
      await actions?.handleStartLocalTrain(vision, { batchSize: 16, overrideFrozen: true });
    });
    expect(mocked.triggerQuickTrain).toHaveBeenCalledWith({ model_key: "upn_v2", batch_size: 16, override_frozen: true });
  });
});
