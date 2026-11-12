// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SoupBlendDialog } from "../SoupBlendDialog";
import { ModelItem } from "../../../api/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MODEL: ModelItem = {
  key: "upn_v2",
  display_name: "UPN v2",
  architecture: "MobileNetV3",
  task_type: "enhance",
  is_fully_trained: false,
  training_status: "partially_trained",
  sota_details: [
    { key: "psnr", label: "PSNR", target: 30, achieved: 28.1, lower_is_better: false, passed: false },
    { key: "lpips", label: "LPIPS", target: 0.1, achieved: 0.14, lower_is_better: true, passed: false },
  ],
};

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

describe("SoupBlendDialog", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onBlend = vi.fn();

  const render = async (model: ModelItem) => {
    await act(async () => {
      root.render(<SoupBlendDialog model={model} onClose={vi.fn()} onBlend={onBlend} isBusy={false} />);
    });
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("sends the picked donors with normalised weights", async () => {
    await render(MODEL);
    expect(byId<HTMLInputElement>("soup-mode-pick").checked).toBe(true);
    const weight = byId<HTMLInputElement>("soup-weight-psnr");
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setValue?.call(weight, "3");
      weight.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.ownerDocument.body.textContent).toContain("75.0%");
    await act(async () => byId<HTMLButtonElement>("soup-btn-blend").click());
    expect(onBlend).toHaveBeenCalledWith("upn_v2", { donors: ["psnr", "lpips"], weights: [0.75, 0.25] });
  });

  it("blocks blending with fewer than two donors", async () => {
    await render(MODEL);
    await act(async () => byId<HTMLInputElement>("soup-donor-lpips").click());
    expect(byId<HTMLButtonElement>("soup-btn-blend").disabled).toBe(true);
    expect(document.body.textContent).toContain("Pick at least 2 donor checkpoints.");
  });

  it("falls back to every vault checkpoint when fewer than two metrics are measured", async () => {
    await render({ ...MODEL, sota_details: MODEL.sota_details?.slice(0, 1) });
    expect(byId<HTMLInputElement>("soup-mode-pick").disabled).toBe(true);
    await act(async () => byId<HTMLButtonElement>("soup-btn-blend").click());
    expect(onBlend).toHaveBeenCalledWith("upn_v2", null);
  });
});
