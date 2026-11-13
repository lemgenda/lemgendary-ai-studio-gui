// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudTrainModal } from "../CloudTrainModal";
import { KaggleSuiteStatus, ModelItem } from "../../api/types";
import { ECOSYSTEM } from "../../api/ecosystem";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    validateModelIsolation: vi.fn(async () => ({
      model_key: "upn_v2",
      is_valid: false,
      variations: {
        "pytorch/default": { variation: "pytorch/default", is_valid: true, files_found: ["checkpoints/best.pth"], errors: [], warnings: [] },
        "onnx/fp16": { variation: "onnx/fp16", is_valid: false, files_found: [], errors: ["missing UPNv2.onnx"], warnings: [] },
      },
      all_errors: ["missing UPNv2.onnx"],
    })),
    fetchKaggleKernels: vi.fn(async () => []),
    fetchKaggleAccelerators: vi.fn(async () => ({
      list: {
        default: "gpu-t4x2",
        accelerators: [
          { id: "cpu", label: "CPU", kind: "cpu", machine_shape: null },
          { id: "gpu-t4x2", label: "GPU T4 x2", kind: "gpu", machine_shape: "NvidiaTeslaT4" },
          { id: "tpu-v5e8", label: "TPU v5e-8", kind: "tpu", machine_shape: "TpuV5E8" },
        ],
      },
      source: "sidecar",
    })),
    fetchModelKaggleHandles: vi.fn(async () => ({
      slug: "upn-v2",
      datasetUrls: ["https://www.kaggle.com/datasets/alice/lemgendizedupnv2"],
    })),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MODEL: ModelItem = {
  key: "upn_v2",
  display_name: "UPN v2",
  architecture: "MobileNetV3",
  task_type: "enhance",
  is_fully_trained: false,
  training_status: "weights_ready",
};

const AUTHENTICATED: KaggleSuiteStatus = {
  authenticated: true,
  username: "alice",
  token_configured: true,
  auth_method: "access_token",
  http_status: 200,
  error: null,
};

describe("CloudTrainModal Kaggle launch", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderModal(status: KaggleSuiteStatus | null, onLaunchKaggle = vi.fn(async () => undefined)) {
    await act(async () => {
      root.render(
        <CloudTrainModal
          isOpen
          onClose={vi.fn()}
          model={MODEL}
          onLaunchKaggle={onLaunchKaggle}
          onMonitorKaggle={vi.fn(async () => undefined)}
          kaggleAuthStatus={status}
          isBusy={false}
        />
      );
    });
    return onLaunchKaggle;
  }

  it("offers the served accelerators (no P100) and sends the picked id and poll interval", async () => {
    const onLaunchKaggle = await renderModal(AUTHENTICATED);
    const select = document.getElementById("kaggle-accelerator-select") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["cpu", "gpu-t4x2", "tpu-v5e8"]);
    expect(select.value).toBe("gpu-t4x2");
    expect(container.textContent).not.toContain("P100");

    await act(async () => {
      select.value = "tpu-v5e8";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const poll = document.getElementById("kaggle-poll-interval-input") as HTMLInputElement;
    expect(poll.value).toBe("30");
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setValue?.call(poll, "3");
      poll.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const launch = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Launch Cloud Training");
    await act(async () => {
      launch?.click();
    });
    expect(onLaunchKaggle).toHaveBeenCalledWith("upn_v2", {
      accelerator: "tpu-v5e8",
      autoPull: true,
      pollInterval: 5,
      autoResume: false,
      maxResumes: null,
      overrideFrozen: false,
    });
  });

  it("offers the frozen settings override unchecked; checked it is sent with the launch", async () => {
    const onLaunchKaggle = await renderModal(AUTHENTICATED);
    const override = document.getElementById("kaggle-override-frozen-checkbox") as HTMLInputElement;
    expect(override.checked).toBe(false);
    await act(async () => {
      override.click();
    });
    const launch = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Launch Cloud Training");
    await act(async () => {
      launch?.click();
    });
    expect(onLaunchKaggle).toHaveBeenCalledWith("upn_v2", expect.objectContaining({ overrideFrozen: true }));
  });

  it("offers auto-resume unchecked; checked it sends the typed resume limit", async () => {
    const onLaunchKaggle = await renderModal(AUTHENTICATED);
    const resume = document.getElementById("kaggle-auto-resume-checkbox") as HTMLInputElement;
    const max = document.getElementById("kaggle-max-resumes-input") as HTMLInputElement;
    expect(resume.checked).toBe(false);
    expect(max.disabled).toBe(true);
    await act(async () => {
      resume.click();
    });
    expect(max.disabled).toBe(false);
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setValue?.call(max, "2");
      max.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const launch = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Launch Cloud Training");
    await act(async () => {
      launch?.click();
    });
    expect(onLaunchKaggle).toHaveBeenCalledWith("upn_v2", expect.objectContaining({ autoResume: true, maxResumes: 2 }));
  });

  it("falls back to the ecosystem kaggle_owner when the status gives no username", async () => {
    await renderModal({ ...AUTHENTICATED, authenticated: false, username: "" });
    const owner = encodeURIComponent(ECOSYSTEM.identity.kaggle_owner);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain(`https://www.kaggle.com/code/${owner}/upn-v2-training`);
    expect(hrefs).toContain(`https://www.kaggle.com/models/${owner}/upn-v2`);
  });

  it("links the kernel, model and datasets from the backend handles", async () => {
    await renderModal(AUTHENTICATED);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("https://www.kaggle.com/code/alice/upn-v2-training");
    expect(hrefs).toContain("https://www.kaggle.com/models/alice/upn-v2");
    expect(hrefs).toContain("https://www.kaggle.com/datasets/alice/lemgendizedupnv2");
    expect(document.getElementById("cloud-modal-auth-error")).toBeNull();
  });

  it("shows an error banner when Kaggle refused the credentials", async () => {
    await renderModal({ ...AUTHENTICATED, authenticated: false, http_status: 401, error: "Unauthorized" });
    expect(document.getElementById("cloud-modal-auth-badge")?.textContent).toBe("NOT AUTHENTICATED");
    expect(document.getElementById("cloud-modal-auth-error")?.textContent).toContain("HTTP 401");
  });

  it("shows the isolation report under the backend variation keys", async () => {
    await renderModal(AUTHENTICATED);
    await act(async () => {
      document.getElementById("train-modal-tab-upload")?.click();
    });
    const cards = Array.from(container.querySelectorAll("[data-variation]")).map((el) => el.getAttribute("data-variation"));
    expect(cards).toEqual(["pytorch/default", "pytorch/fp32", "onnx/fp16", "onnx/fp32"]);
    expect(container.querySelector('[data-variation="pytorch/default"]')?.textContent).toContain("ISOLATED");
    expect(container.querySelector('[data-variation="onnx/fp16"]')?.textContent).toContain("missing UPNv2.onnx");
    const variation = document.getElementById("variation-select") as HTMLSelectElement;
    expect(Array.from(variation.options).map((o) => o.value)).toEqual(["all", "pytorch/default", "pytorch/fp32", "onnx/fp16", "onnx/fp32"]);
  });
});
