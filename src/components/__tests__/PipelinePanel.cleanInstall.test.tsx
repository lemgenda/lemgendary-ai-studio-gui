// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PipelinePanel } from "../PipelinePanel";
import { triggerPipeline } from "../../api/client";

// Tell React this is a test environment so act() flushes updates synchronously.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PipelinePanel run and clean install", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "accepted" }))
    );
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <PipelinePanel
          isRunning={false}
          onRunPipeline={(clean) => void triggerPipeline({ clean })}
          recentEvents={[]}
          envManagerOnline={true}
        />
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const button = (id: string): HTMLButtonElement => {
    const el = document.getElementById(id);
    if (!(el instanceof HTMLButtonElement)) throw new Error(`button #${id} not rendered`);
    return el;
  };

  const sentBodies = (): Array<Record<string, unknown>> =>
    fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));

  it("sends clean: false for a normal run", () => {
    act(() => button("dash-btn-run-pipeline").click());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/pipeline\/run$/);
    expect(sentBodies()).toEqual([{ target_project: null, clean: false }]);
  });

  it("opens an accessible dialog with focus on Cancel and sends nothing yet", () => {
    act(() => button("pipeline-btn-clean-install").click());

    const dialog = document.getElementById("pipeline-dialog-clean-install");
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    const titleId = dialog?.getAttribute("aria-labelledby") ?? "";
    expect(document.getElementById(titleId)?.textContent).toBe("Confirm clean install");
    expect(dialog?.textContent).toContain("node_modules");
    expect(dialog?.textContent).toContain(".venv");
    expect(document.activeElement?.id).toBe("pipeline-btn-clean-cancel");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends clean: true only after Confirm", () => {
    act(() => button("pipeline-btn-clean-install").click());
    act(() => button("pipeline-btn-clean-confirm").click());

    expect(sentBodies()).toEqual([{ target_project: null, clean: true }]);
    expect(document.getElementById("pipeline-dialog-clean-install")).toBeNull();
  });

  it("sends nothing when Cancel is clicked", () => {
    act(() => button("pipeline-btn-clean-install").click());
    act(() => button("pipeline-btn-clean-cancel").click());

    expect(document.getElementById("pipeline-dialog-clean-install")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends nothing when Escape is pressed", () => {
    act(() => button("pipeline-btn-clean-install").click());
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(document.getElementById("pipeline-dialog-clean-install")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
