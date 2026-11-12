// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudTrainModal } from "../CloudTrainModal";
import { isKernelSlug } from "../training/kaggleLinks";
import { ModelItem } from "../../api/types";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    validateModelIsolation: vi.fn(async () => {
      throw new Error("offline");
    }),
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

describe("isKernelSlug", () => {
  it("accepts owner/kernel references only", () => {
    expect(isKernelSlug("owner/upn-train")).toBe(true);
    expect(isKernelSlug(" owner/upn-train ")).toBe(true);
    expect(isKernelSlug("upn-train")).toBe(false);
    expect(isKernelSlug("owner/a/b")).toBe(false);
    expect(isKernelSlug("")).toBe(false);
  });
});

describe("CloudTrainModal kernel monitor", () => {
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

  it("attaches to the typed kernel and closes", async () => {
    const onMonitorKaggle = vi.fn(async () => undefined);
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <CloudTrainModal
          isOpen
          onClose={onClose}
          model={MODEL}
          onLaunchKaggle={vi.fn(async () => undefined)}
          onMonitorKaggle={onMonitorKaggle}
          kaggleAuthStatus={null}
          isBusy={false}
        />
      );
    });
    const button = document.getElementById("kaggle-monitor-btn") as HTMLButtonElement;
    const input = document.getElementById("kaggle-monitor-slug") as HTMLInputElement;
    expect(button.disabled).toBe(true);

    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setValue?.call(input, "owner/upn-train");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(button.disabled).toBe(false);

    await act(async () => {
      button.click();
    });
    expect(onMonitorKaggle).toHaveBeenCalledWith("owner/upn-train", "upn_v2", true);
    expect(onClose).toHaveBeenCalled();
  });
});
