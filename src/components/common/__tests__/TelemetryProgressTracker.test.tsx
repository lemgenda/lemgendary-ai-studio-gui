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

  it("returns null when progress object is null", () => {
    const html = renderToStaticMarkup(
      <TelemetryProgressTracker progress={null} />
    );
    expect(html).toBe("");
  });
});
