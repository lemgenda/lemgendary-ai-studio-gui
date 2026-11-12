import { describe, expect, it } from "vitest";
import { buildSoupRecipe, defaultSoupDrafts, soupDonorCandidates } from "../soupRecipe";
import { ModelItem } from "../../../api/types";

const MODEL: ModelItem = {
  key: "upn_v2",
  display_name: "UPN v2",
  architecture: "MobileNetV3",
  task_type: "enhance",
  is_fully_trained: false,
  training_status: "partially_trained",
  sota_details: [
    { key: "psnr", label: "PSNR", target: 30, achieved: 28.1, lower_is_better: false, passed: false },
    { key: "lpips", label: "LPIPS", target: 0.1, achieved: 0.14, lower_is_better: true, passed: false },
    { key: "ssim", label: "SSIM", target: 0.9, achieved: null, lower_is_better: false, passed: false },
  ],
};

describe("soup recipe", () => {
  it("offers only measured SOTA metrics as vault donors", () => {
    expect(soupDonorCandidates(MODEL).map((c) => c.key)).toEqual(["psnr", "lpips"]);
  });

  it("defaults to every donor with equal weights, normalised to uniform", () => {
    const result = buildSoupRecipe(defaultSoupDrafts(soupDonorCandidates(MODEL)));
    expect(result).toEqual({ ok: true, recipe: { donors: ["psnr", "lpips"], weights: [0.5, 0.5] } });
  });

  it("normalises custom weights to sum to 1", () => {
    const drafts = defaultSoupDrafts(soupDonorCandidates(MODEL)).map((d) => ({ ...d, weight: d.key === "psnr" ? "3" : "1" }));
    const result = buildSoupRecipe(drafts);
    expect(result.ok && result.recipe.weights).toEqual([0.75, 0.25]);
  });

  it("rejects fewer than two donors, bad weights and a zero sum", () => {
    const drafts = defaultSoupDrafts(soupDonorCandidates(MODEL));
    expect(buildSoupRecipe([{ ...drafts[0] }, { ...drafts[1], selected: false }])).toEqual({
      ok: false,
      error: "Pick at least 2 donor checkpoints.",
    });
    expect(buildSoupRecipe([{ ...drafts[0], weight: "-1" }, drafts[1]]).ok).toBe(false);
    expect(buildSoupRecipe([{ ...drafts[0], weight: "" }, drafts[1]]).ok).toBe(false);
    expect(buildSoupRecipe(drafts.map((d) => ({ ...d, weight: "0" })))).toEqual({
      ok: false,
      error: "At least one donor needs a weight above 0.",
    });
  });
});
