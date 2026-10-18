import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { LogPanel } from "../LogPanel";
import { PipelineStepCards } from "../PipelineStepCards";
import { PipelineEvent } from "../../api/types";

describe("PipelineLifecycle & Step Completion Rendering", () => {
  it("hides progress bar in LogPanel when pipeline finishes with terminal warning", () => {
    const events: PipelineEvent[] = [
      {
        timestamp: "2026-10-18T15:00:00Z",
        step_number: 4,
        total_steps: 7,
        step_name: "Package Installation",
        status: "info",
        message: "DOWNLOADING: torch - 1.2/2.4 GB 25.1 MB/s eta 0:00:48",
        is_progress: true,
      },
      {
        timestamp: "2026-10-18T15:04:09Z",
        step_number: 7,
        total_steps: 7,
        step_name: "Health Matrix",
        status: "warning",
        message: "Pipeline execution completed. Ecosystem healthy status: False.",
        is_progress: false,
      },
    ];

    const html = renderToStaticMarkup(
      <LogPanel events={events} onClear={() => {}} isConnected={true} />
    );

    // Progress bar must NOT be rendered when the terminal event has completed
    expect(html).not.toContain('role="progressbar"');
    expect(html).toContain("Pipeline execution completed");
  });

  it("renders progress bar in LogPanel when active progress event is in flight", () => {
    const events: PipelineEvent[] = [
      {
        timestamp: "2026-10-18T15:00:00Z",
        step_number: 4,
        total_steps: 7,
        step_name: "Package Installation",
        status: "info",
        message: "DOWNLOADING: torch - 1.2/2.4 GB 25.1 MB/s eta 0:00:48",
        is_progress: true,
      },
    ];

    const html = renderToStaticMarkup(
      <LogPanel events={events} onClear={() => {}} isConnected={true} />
    );

    // Progress bar MUST be rendered while in flight
    expect(html).toContain('role="progressbar"');
    expect(html).toContain("DOWNLOADING");
    expect(html).toContain("torch");
  });

  it("renders Step 7 as WARNING (not RUNNING) when Step 7 completes with warning", () => {
    const events: PipelineEvent[] = [
      {
        timestamp: "2026-10-18T15:04:09Z",
        step_number: 7,
        total_steps: 7,
        step_name: "Health Matrix",
        status: "warning",
        message: "Pipeline execution completed. Ecosystem healthy status: False.",
        is_progress: false,
      },
    ];

    const html = renderToStaticMarkup(
      <PipelineStepCards
        isRunning={true}
        activeStepNum={7}
        onRunStep={async () => {}}
        recentEvents={events}
        envManagerOnline={true}
      />
    );

    // Step 7 must show WARNING badge and not RUNNING
    expect(html).toContain("WARNING");
    expect(html).not.toContain("RUNNING");
    // Indeterminate step progress bar must not be rendered
    expect(html).not.toContain('aria-label="Step 7 execution progress"');
  });

  it("renders Step 7 as PASSED when Step 7 completes with success", () => {
    const events: PipelineEvent[] = [
      {
        timestamp: "2026-10-18T15:04:09Z",
        step_number: 7,
        total_steps: 7,
        step_name: "Health Matrix",
        status: "success",
        message: "Pipeline execution completed. Ecosystem healthy status: True.",
        is_progress: false,
      },
    ];

    const html = renderToStaticMarkup(
      <PipelineStepCards
        isRunning={true}
        activeStepNum={7}
        onRunStep={async () => {}}
        recentEvents={events}
        envManagerOnline={true}
      />
    );

    expect(html).toContain("PASSED");
    expect(html).not.toContain("RUNNING");
    expect(html).not.toContain('aria-label="Step 7 execution progress"');
  });
});
