import { describe, expect, it } from "vitest";
import { parseCompileLimits } from "../compileLimits";

describe("parseCompileLimits", () => {
  it("omits empty fields so the preset and sidecar defaults apply", () => {
    expect(parseCompileLimits("", " ")).toEqual({ ok: true, overrides: {} });
  });

  it("parses a positive size in GB and a whole worker count", () => {
    expect(parseCompileLimits("12.5", "6")).toEqual({ ok: true, overrides: { max_gb: 12.5, workers: 6 } });
  });

  it("rejects a size of 0 or less and a fractional or zero worker count", () => {
    expect(parseCompileLimits("0", "").ok).toBe(false);
    expect(parseCompileLimits("abc", "").ok).toBe(false);
    expect(parseCompileLimits("", "2.5").ok).toBe(false);
    expect(parseCompileLimits("", "0").ok).toBe(false);
  });
});
