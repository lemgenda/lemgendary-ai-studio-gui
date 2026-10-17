import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { TelemetryProgressTracker } from "../TelemetryProgressTracker";
import { parseProgressMessage } from "../../../utils/progressParser";
import { rollupTelemetryEvents } from "../../../api/client";
import { PipelineEvent } from "../../../api/types";

describe("TelemetryProgressTracker & progressParser", () => {
  it("parses dataset archiving progress and renders accessible progressbar", () => {
    const raw = "ARCHIVING: LemGendizedClassificationMaster.zip - 45.2% [31.2 GB / 69.2 GB, 45.2 MB/s, ETA: 00:14:10]";
    const parsed = parseProgressMessage(raw, "Compiler");
    expect(parsed).not.toBeNull();
    expect(parsed?.percentage).toBe(45.2);
    expect(parsed?.operation).toBe("ARCHIVING");
    expect(parsed?.target).toBe("LemGendizedClassificationMaster.zip");
    expect(parsed?.rate).toBe("45.2 MB/s");
    expect(parsed?.eta).toBe("00:14:10");

    const html = renderToStaticMarkup(
      <TelemetryProgressTracker progress={parsed} />
    );
    expect(html).toContain("ARCHIVING");
    expect(html).toContain("LemGendizedClassificationMaster.zip");
    expect(html).toContain("45.2%");
    expect(html).toContain("45.2 MB/s");
    expect(html).toContain("ETA: 00:14:10");
    expect(html).toContain('role="progressbar"');
  });

  it("parses model training epoch batch metrics correctly", () => {
    const raw = "[EPOCH 1/50] 25/100 batches [25.0%] - loss: 0.0432, lr: 0.0001 - ETA: 00:02:15";
    const parsed = parseProgressMessage(raw, "Training");
    expect(parsed).not.toBeNull();
    expect(parsed?.percentage).toBe(25);
    expect(parsed?.operation).toBe("TRAINING");
    expect(parsed?.source).toBe("training");

    const html = renderToStaticMarkup(
      <TelemetryProgressTracker progress={parsed} />
    );
    expect(html).toContain("TRAINING");
    expect(html).toContain("25.0%");
    expect(html).toContain('role="progressbar"');
  });

  it("parses model training batch ratio and renders exact percentage and it/s rate", () => {
    const raw = "  [BATCH     20/109196] Loss: 0.3191 | AvgLoss: 0.6325 | LR: 0.001000 | 1117.9s";
    const parsed = parseProgressMessage(raw, "Training");
    expect(parsed).not.toBeNull();
    expect(parsed?.operation).toBe("TRAINING");
    expect(parsed?.target).toBe("Batch 20/109196");
    expect(parsed?.percentage).toBeCloseTo(0.0183, 3);
    expect(parsed?.isIndeterminate).toBe(false);

    const html = renderToStaticMarkup(
      <TelemetryProgressTracker progress={parsed} />
    );
    expect(html).toContain("TRAINING");
    expect(html).toContain("0.02%");
    expect(html).toContain("Batch 20/109196");
    expect(html).not.toContain("IN-FLIGHT");
  });

  it("parses modern batch progression with explicit percentage and ETA", () => {
    const raw = "  [BATCH     20/16379] (0.12%) Loss: 0.3191 | AvgLoss: 0.6325 | LR: 0.001000 | 5.42 it/s | ETA 50m24s | 3.7s";
    const parsed = parseProgressMessage(raw, "Training");
    expect(parsed).not.toBeNull();
    expect(parsed?.percentage).toBe(0.12);
    expect(parsed?.rate).toBe("5.42 it/s");
    expect(parsed?.eta).toBe("50m24s");
    expect(parsed?.isIndeterminate).toBe(false);

    const html = renderToStaticMarkup(
      <TelemetryProgressTracker progress={parsed} />
    );
    expect(html).toContain("0.12%");
    expect(html).toContain("5.42 it/s");
    expect(html).toContain("ETA 50m24s");
  });

  it("parses dataset upload progress cleanly without target percentage duplication or rate duplication", () => {
    const raw = "Uploading: 45% 1.23G/2.74G [3:25:49<3:59:04, 2.76MB/s]";
    const parsed = parseProgressMessage(raw, "Compiler");
    expect(parsed).not.toBeNull();
    expect(parsed?.percentage).toBe(45);
    expect(parsed?.operation).toBe("Uploading");
    // Target must NOT be "45%"
    expect(parsed?.target).toBeUndefined();
    expect(parsed?.rate).toBe("2.76MB/s");

    const html = renderToStaticMarkup(
      <TelemetryProgressTracker progress={parsed} />
    );
    expect(html).toContain("Uploading");
    expect(html).toContain("45.0%");
    // No duplicate rate when already in [3:25:49<3:59:04, 2.76MB/s]
    const rateCount = (html.match(/2\.76MB\/s/g) || []).length;
    expect(rateCount).toBe(1);
  });

  it("returns null when progress object is null", () => {
    const html = renderToStaticMarkup(
      <TelemetryProgressTracker progress={null} />
    );
    expect(html).toBe("");
  });

  it("rollupTelemetryEvents rolls up consecutive transient progress ticks but preserves all training batch metrics", () => {
    const rawEvents: PipelineEvent[] = [
      {
        step_number: 1,
        total_steps: 1,
        step_name: "Compiler",
        status: "info",
        message: "Starting Kaggle upload for dataset...",
        is_progress: false,
        timestamp: "2026-10-17T17:00:00Z",
        origin: "dataset-compiler",
      },
      {
        step_number: 1,
        total_steps: 1,
        step_name: "Compiler",
        status: "info",
        message: "Uploading: 10% 100M/1G [00:01<00:09, 100MB/s]",
        is_progress: true,
        timestamp: "2026-10-17T17:00:01Z",
        origin: "dataset-compiler",
      },
      {
        step_number: 1,
        total_steps: 1,
        step_name: "Compiler",
        status: "info",
        message: "Uploading: 20% 200M/1G [00:02<00:08, 100MB/s]",
        is_progress: true,
        timestamp: "2026-10-17T17:00:02Z",
        origin: "dataset-compiler",
      },
      {
        step_number: 1,
        total_steps: 1,
        step_name: "Compiler",
        status: "info",
        message: "Uploading: 45% 450M/1G [00:04<00:05, 100MB/s]",
        is_progress: true,
        timestamp: "2026-10-17T17:00:04Z",
        origin: "dataset-compiler",
      },
      // Model training batch logs
      {
        step_number: 2,
        total_steps: 2,
        step_name: "Training",
        status: "info",
        message: "[EPOCH 1/50] Initiating training pass...",
        is_progress: false,
        timestamp: "2026-10-17T17:01:00Z",
        origin: "training-suite",
      },
      {
        step_number: 2,
        total_steps: 2,
        step_name: "Training",
        status: "info",
        message: "  [BATCH 1/100] (1.00%) Loss: 0.5123 | AvgLoss: 0.5123 | LR: 0.001000 | 1.2 s/it | ETA 2m00s | 1.2s",
        is_progress: true,
        timestamp: "2026-10-17T17:01:01Z",
        origin: "training-suite",
      },
      {
        step_number: 2,
        total_steps: 2,
        step_name: "Training",
        status: "info",
        message: "  [BATCH 2/100] (2.00%) Loss: 0.4981 | AvgLoss: 0.5052 | LR: 0.001000 | 1.1 s/it | ETA 1m48s | 2.3s",
        is_progress: true,
        timestamp: "2026-10-17T17:01:02Z",
        origin: "training-suite",
      },
    ];

    const rolled = rollupTelemetryEvents(rawEvents);
    // Compiler transient progress rolled up: 1 initial log + 1 final active tick (45%)
    // Training batch logs rolled up into single live line: 1 epoch start + 1 active batch line (batch 2)
    // Total: 2 (compiler) + 2 (training) = 4 events
    expect(rolled.length).toBe(4);
    expect(rolled[0].message).toBe("Starting Kaggle upload for dataset...");
    expect(rolled[1].message).toContain("Uploading: 45%");
    expect(rolled[2].message).toBe("[EPOCH 1/50] Initiating training pass...");
    expect(rolled[3].message).toContain("[BATCH 2/100]");
  });
});
