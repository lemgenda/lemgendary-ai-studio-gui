import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { TelemetryProgressTracker } from "../TelemetryProgressTracker";
import { parseProgressMessage } from "../../../utils/progressParser";

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
    expect(html).toContain("ETA 00:14:10");
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

  it("returns null when progress object is null", () => {
    const html = renderToStaticMarkup(
      <TelemetryProgressTracker progress={null} />
    );
    expect(html).toBe("");
  });
});
