// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TelemetryConsole, TelemetryConsoleProps } from "../TelemetryConsole";
import { PipelineEvent } from "../../../api/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SCROLL_HEIGHT = 1234;

function logEvent(message: string): PipelineEvent {
  return {
    timestamp: "2026-11-12T10:00:00.000Z",
    step_number: 0,
    total_steps: 1,
    step_name: "Training",
    status: "info",
    message,
    origin: "training-suite",
  };
}

const noop = (): void => undefined;

function props(overrides: Partial<TelemetryConsoleProps>): TelemetryConsoleProps {
  return {
    activeTelemetryTab: "local",
    onTabChange: noop,
    localJobId: "job-1",
    localJobModel: "upn_v2",
    remoteJobId: null,
    remoteJobModel: null,
    displayedLocalEvents: [],
    displayedRemoteEvents: [],
    onCopyLocalStream: noop,
    localCopied: false,
    onClearLocalStream: noop,
    onStopLocalTrain: noop,
    isStoppingLocal: false,
    onCopyRemoteStream: noop,
    remoteCopied: false,
    onClearRemoteStream: noop,
    ...overrides,
  };
}

describe("TelemetryConsole auto-scroll", () => {
  let container: HTMLDivElement;
  let root: Root;
  let original: PropertyDescriptor | undefined;

  beforeEach(() => {
    // jsdom has no layout; give every element a fixed scroll height.
    original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => SCROLL_HEIGHT });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    if (original) {
      Object.defineProperty(HTMLElement.prototype, "scrollHeight", original);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
    }
  });

  const log = (label: string): HTMLElement => container.querySelector(`[aria-label="${label}"]`) as HTMLElement;

  it("scrolls the local stream to the newest line when events arrive", () => {
    act(() => root.render(<TelemetryConsole {...props({})} />));
    const local = log("Local training stream log");
    local.scrollTop = 0;
    act(() => root.render(<TelemetryConsole {...props({ displayedLocalEvents: [logEvent("epoch 1 loss 0.2")] })} />));
    expect(local.scrollTop).toBe(SCROLL_HEIGHT);
  });

  it("scrolls the remote stream when its tab is shown", () => {
    const remoteEvents = [logEvent("kernel running")];
    act(() => root.render(<TelemetryConsole {...props({ activeTelemetryTab: "remote", displayedRemoteEvents: remoteEvents })} />));
    expect(log("Remote cloud training stream log").scrollTop).toBe(SCROLL_HEIGHT);
  });
});
