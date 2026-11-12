// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BatchSizeSelector } from "../BatchSizeSelector";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("BatchSizeSelector", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onChange = vi.fn();

  const render = (value: number) =>
    act(() => root.render(<BatchSizeSelector modelKey="upn_v2" value={value} onChange={onChange} disabled={false} modelName="UPN v2" />));

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

  it("shows the custom input only after Custom is picked and reports whole sizes", () => {
    render(8);
    const select = document.getElementById("train-select-batch-upn_v2") as HTMLSelectElement;
    expect(document.getElementById("train-input-custom-batch-upn_v2")).toBeNull();
    act(() => {
      select.value = "custom";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const input = document.getElementById("train-input-custom-batch-upn_v2") as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    act(() => {
      setValue?.call(input, "48");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onChange).toHaveBeenLastCalledWith(48);
    act(() => {
      setValue?.call(input, "0");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("opens on the custom input when the registry batch size is not a preset", () => {
    render(6);
    expect((document.getElementById("train-select-batch-upn_v2") as HTMLSelectElement).value).toBe("custom");
    expect((document.getElementById("train-input-custom-batch-upn_v2") as HTMLInputElement).value).toBe("6");
  });
});
