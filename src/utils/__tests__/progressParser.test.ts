import { describe, it, expect } from "vitest";
import { parseProgressMessage } from "../progressParser";

describe("parseProgressMessage", () => {
  it("parses training batch ratios and percentage", () => {
    const res = parseProgressMessage("[BATCH 25/100] loss=0.1234 | 25.0%", "Training");
    expect(res).not.toBeNull();
    expect(res?.percentage).toBe(25);
    expect(res?.operation).toBe("TRAINING");
    expect(res?.target).toBe("Batch 25/100");
    expect(res?.source).toBe("training");
  });

  it("parses EPOCH X/Y patterns", () => {
    const res = parseProgressMessage("EPOCH 6/20 - 30% | PSNR=31.4 dB");
    expect(res).not.toBeNull();
    expect(res?.percentage).toBe(30);
    expect(res?.operation).toBe("TRAINING");
    expect(res?.target).toBe("Epoch 6/20");
  });

  it("parses [Step X/Y] pipeline patterns", () => {
    const res = parseProgressMessage("[Step 3/6] Installing requirements for lemgendary-training-suite");
    expect(res).not.toBeNull();
    expect(res?.percentage).toBe(50);
    expect(res?.operation).toBe("PACKAGE INSTALLATION");
    expect(res?.target).toBe("lemgendary-training-suite");
    expect(res?.source).toBe("pipeline");
  });

  it("parses tqdm-style X/Y [elapsed<remaining, rate] counters", () => {
    const res = parseProgressMessage("ARCHIVING: LemGendizedUpnV2 25% [250/1000] 00:12<00:36, 20.5it/s");
    expect(res).not.toBeNull();
    expect(res?.percentage).toBe(25);
    expect(res?.rate).toBe("20.5it/s");
    expect(res?.eta).toBe("00:36");
  });

  it("returns null for non-progress messages", () => {
    expect(parseProgressMessage("Server started on port 8200")).toBeNull();
    expect(parseProgressMessage("")).toBeNull();
  });
});
