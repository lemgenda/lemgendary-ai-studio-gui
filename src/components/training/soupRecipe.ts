/**
 * LemGendary AI Studio - Pareto Model Soup recipe: donor candidates,
 * weight validation and normalisation for `POST /api/models/{model_key}/soup`.
 *
 * The Training Suite writes one vault checkpoint `vault_<metric>.pth` per SOTA
 * target the first time that metric is measured and again on every new best
 * (`training/checkpoint/lifecycle_manager.py`). A donor is named by that
 * metric key; the sidecar resolves it to the vault file.
 */

import { ModelItem } from "../../api/types";

/** The soup endpoint blends at least two checkpoints (`MIN_SOUP_DONORS`). */
export const MIN_SOUP_DONORS = 2;

/** Default weight of every donor: equal weights blend uniformly. */
export const DEFAULT_DONOR_WEIGHT = 1;

export interface SoupDonorCandidate {
  /** Vault metric key sent as the donor name. */
  key: string;
  label: string;
}

/** One donor row of the dialog: chosen or not, with its raw (unnormalised) weight text. */
export interface SoupDonorDraft extends SoupDonorCandidate {
  selected: boolean;
  weight: string;
}

/** Donors and normalised weights sent to the sidecar. */
export interface SoupRecipe {
  donors: string[];
  weights: number[];
}

/** SOTA metrics with a measured value: the only ones that can have a vault checkpoint. */
export function soupDonorCandidates(model: ModelItem): SoupDonorCandidate[] {
  return (model.sota_details ?? [])
    .filter((detail) => detail.achieved !== null && detail.achieved !== undefined)
    .map((detail) => ({ key: detail.key, label: detail.label }));
}

/** Every candidate selected with the same weight: the uniform default. */
export function defaultSoupDrafts(candidates: readonly SoupDonorCandidate[]): SoupDonorDraft[] {
  return candidates.map((c) => ({ ...c, selected: true, weight: String(DEFAULT_DONOR_WEIGHT) }));
}

export type SoupRecipeResult = { ok: true; recipe: SoupRecipe } | { ok: false; error: string };

/**
 * Validate the chosen donors and scale their weights to sum to 1, under the
 * same rules as the sidecar (`training/model_soup.py::_validate_weights`):
 * at least two donors, every weight finite and non-negative, a positive sum.
 */
export function buildSoupRecipe(drafts: readonly SoupDonorDraft[]): SoupRecipeResult {
  const chosen = drafts.filter((d) => d.selected);
  if (chosen.length < MIN_SOUP_DONORS) {
    return { ok: false, error: `Pick at least ${MIN_SOUP_DONORS} donor checkpoints.` };
  }
  const raw = chosen.map((d) => (d.weight.trim() === "" ? Number.NaN : Number(d.weight)));
  const badIndex = raw.findIndex((w) => !Number.isFinite(w) || w < 0);
  if (badIndex >= 0) {
    return { ok: false, error: `Weight of ${chosen[badIndex].label} must be a number of 0 or more.` };
  }
  const total = raw.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    return { ok: false, error: "At least one donor needs a weight above 0." };
  }
  return { ok: true, recipe: { donors: chosen.map((d) => d.key), weights: raw.map((w) => w / total) } };
}
