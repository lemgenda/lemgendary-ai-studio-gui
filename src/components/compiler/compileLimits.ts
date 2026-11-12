/**
 * LemGendary AI Studio - optional size and worker overrides of a standard
 * compile (`QuickCompileRequest.max_gb` and `.workers`).
 */

import { QuickCompilePayload } from "../../api/types";

export type CompileLimitOverrides = Pick<QuickCompilePayload, "max_gb" | "workers">;

export type CompileLimitsResult = { ok: true; overrides: CompileLimitOverrides } | { ok: false; error: string };

/** Parse the form text; an empty field is omitted so the preset or sidecar default applies. */
export function parseCompileLimits(maxGbText: string, workersText: string): CompileLimitsResult {
  const overrides: CompileLimitOverrides = {};
  const maxGb = maxGbText.trim();
  if (maxGb !== "") {
    const value = Number(maxGb);
    if (!Number.isFinite(value) || value <= 0) return { ok: false, error: "Max size must be a number of GB above 0." };
    overrides.max_gb = value;
  }
  const workers = workersText.trim();
  if (workers !== "") {
    const value = Number(workers);
    if (!Number.isInteger(value) || value < 1) return { ok: false, error: "Workers must be a whole number of 1 or more." };
    overrides.workers = value;
  }
  return { ok: true, overrides };
}
