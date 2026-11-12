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
      setActiveTelemetryTab: vi.fn(),
      setStatusNotice: vi.fn(),
      setStatusError: vi.fn(),
      loadTrainingData: vi.fn(async () => undefined),
      loadKaggleData: vi.fn(async () => undefined),
      kaggleUsername: undefined,
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
        await actions?.handleLaunchKaggle("upn_v2", "T4", false);
      } catch (err: unknown) {
        thrown = err;
      }
    });
    expect(thrown).toBeInstanceOf(Error);
    expect(lastCall(deps.setStatusError)).toBe("Failed to dispatch Kaggle training: no quota");
  });

  it("tracks a monitored Kaggle kernel as the remote job", async () => {
    mocked.monitorKaggleKernel.mockResolvedValue({
      job_id: "job-7",
      status: "running",
      message: "attached",
      kernel_slug: "owner/upn-train",
    });
    await act(async () => {
      await actions?.handleMonitorKaggle("owner/upn-train", "upn_v2", true);
    });
    expect(mocked.monitorKaggleKernel).toHaveBeenCalledWith({ kernel_slug: "owner/upn-train", model: "upn_v2", auto_pull: true });
    expect(deps.setRemoteJob).toHaveBeenCalledWith({ jobId: "job-7", modelKey: "upn_v2" });
    expect(deps.setActiveTelemetryTab).toHaveBeenCalledWith("remote");
    expect(lastCall(deps.setStatusNotice)).toContain("Monitoring Kaggle kernel owner/upn-train");
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
      await actions?.handleStartLocalTrain(llm, 2);
    });
    expect(mocked.trainLLM).toHaveBeenCalledWith({ model: "ai_helper_lemgend", batch_size: 2, env: "local" });
    expect(mocked.triggerQuickTrain).not.toHaveBeenCalled();
    expect(deps.setLocalJob).toHaveBeenCalledWith({ jobId: "job-llm", modelKey: "ai_helper_lemgend" });
    expect(lastCall(deps.setStatusNotice)).toContain("QLoRA instruction tuning initialized");

    await act(async () => {
      await actions?.handleStartLocalTrain(vision, 8);
    });
    expect(mocked.triggerQuickTrain).toHaveBeenCalledWith({ model_key: "upn_v2", batch_size: 8 });
    expect(mocked.trainLLM).toHaveBeenCalledTimes(1);
  });
});
