// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VariationBadges, variationBadgeState } from "../VariationBadges";
import { ModelItem } from "../../../api/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BASE: ModelItem = {
  key: "upn_v2",
  display_name: "UPN v2",
  architecture: "MobileNetV3",
  task_type: "enhance",
  is_fully_trained: false,
  training_status: "weights_ready",
  checkpoint_exists: true,
};

describe("VariationBadges", () => {
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

  const badgeClass = (flag: string): string =>
    (container.querySelector(`[data-variation="${flag}"]`) as HTMLElement).className;

  it("binds each badge to its own artifact flag, not to checkpoint_exists", () => {
    act(() => root.render(<VariationBadges model={{ ...BASE, pytorch_ready: true, onnx_fp32_ready: false, onnx_fp16_ready: true }} />));
    expect(badgeClass("pytorch_ready")).toContain("badge-success");
    expect(badgeClass("onnx_fp32_ready")).toContain("badge-secondary");
    expect(badgeClass("onnx_fp16_ready")).toContain("badge-success");
  });

  it("does not show unreported formats as ready even when a checkpoint exists", () => {
    act(() => root.render(<VariationBadges model={BASE} />));
    for (const flag of ["pytorch_ready", "onnx_fp32_ready", "onnx_fp16_ready"]) {
      expect(badgeClass(flag)).toContain("badge-secondary");
    }
    expect(container.textContent).toContain("PyTorch (.pt)");
  });

  it("explains missing and unreported states in the tooltip note", () => {
    expect(variationBadgeState(false).note).toBe("artifact missing");
    expect(variationBadgeState(undefined).note).toContain("not reported");
  });
});
