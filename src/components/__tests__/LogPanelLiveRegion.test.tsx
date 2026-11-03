// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LogPanel } from "../LogPanel";
import { PipelineEvent } from "../../api/types";
import { isTerminalEvent, latestMilestone } from "../../api/client";
import { useTransientValue } from "../../utils/useTransientValue";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base: PipelineEvent = {
  timestamp: "2026-11-03T10:00:00Z",
  step_number: 0,
  total_steps: 1,
  step_name: "Training",
  status: "info",
  message: "",
  is_progress: false,
};

describe("terminal events (D30)", () => {
  it("does not treat 'completed' inside a progress line as terminal", () => {
    expect(isTerminalEvent({ ...base, message: "epoch 3 completed", is_progress: true })).toBe(false);
    expect(isTerminalEvent({ ...base, message: "epoch 3 completed" })).toBe(false);
  });

  it("treats errors, final success or warning and the pipeline end message as terminal", () => {
    expect(isTerminalEvent({ ...base, status: "error", is_progress: true })).toBe(true);
    expect(isTerminalEvent({ ...base, status: "success" })).toBe(true);
    expect(isTerminalEvent({ ...base, status: "warning", is_progress: true })).toBe(false);
    expect(isTerminalEvent({ ...base, message: "Pipeline execution completed." })).toBe(true);
  });

  it("keeps the progress bar for a progress line that mentions 'completed'", () => {
    const html = renderToStaticMarkup(
      <LogPanel
        events={[{ ...base, message: "Epoch 3 completed: 45%|####      | 45/100 [00:10<00:12, 4.5it/s]", is_progress: true }]}
        onClear={() => undefined}
        isConnected
      />
    );
    expect(html).toContain('role="progressbar"');
  });
});

describe("log live region (D29)", () => {
  it("announces only the latest milestone, not every log line", () => {
    const events: PipelineEvent[] = [
      { ...base, status: "success", step_name: "Toolchain Audit", message: "Toolchain OK" },
      { ...base, message: "Downloading 10%", is_progress: true },
    ];
    expect(latestMilestone(events)).toBe("Toolchain Audit: Toolchain OK");
    const html = renderToStaticMarkup(<LogPanel events={events} onClear={() => undefined} isConnected />);
    expect(html).toContain('role="log" aria-live="off"');
    expect(html).toMatch(/role="status" aria-live="polite">Toolchain Audit: Toolchain OK</);
  });
});

describe("useTransientValue (D35)", () => {
  afterEach(() => vi.useRealTimers());

  it("resets after the delay and clears its timer on unmount", () => {
    vi.useFakeTimers();
    let current: [string | null, (v: string | null) => void] = [null, () => undefined];
    const Probe = () => {
      current = useTransientValue<string>(1000);
      return null;
    };
    const root = createRoot(document.createElement("div"));
    act(() => root.render(<Probe />));
    act(() => current[1]("saved"));
    expect(current[0]).toBe("saved");
    act(() => vi.advanceTimersByTime(1000));
    expect(current[0]).toBeNull();

    act(() => current[1]("again"));
    act(() => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
  });
});
