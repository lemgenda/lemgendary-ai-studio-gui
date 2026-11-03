/**
 * LemGendary AI Studio - Kaggle URLs for a model, built from the account
 * owner that the Kaggle credentials report (never a hardcoded owner slug).
 */

import { ModelItem } from "../../api/types";

/** Kaggle slug of a model key (`upn_v2` -> `upn-v2`). */
export function kaggleSlug(modelKey: string): string {
  return modelKey.replace(/_/g, "-");
}

export interface KaggleModelLinks {
  notebookUrl: string;
  modelHubUrl: string;
  datasetSearch: string;
}

/** Links for `model` under `owner`; null when the owner is not known yet. */
export function kaggleModelLinks(owner: string | null | undefined, model: Pick<ModelItem, "key">, isForex: boolean): KaggleModelLinks | null {
  const user = owner?.trim();
  if (!user) return null;
  const slug = kaggleSlug(model.key);
  return {
    notebookUrl: `https://www.kaggle.com/code/${encodeURIComponent(user)}/${slug}-training`,
    modelHubUrl: `https://www.kaggle.com/models/${encodeURIComponent(user)}/${slug}`,
    datasetSearch: `${user}/${isForex ? "forexuniverse" : slug}`,
  };
}

/** Owner part of a `kaggle://owner/dataset` (or `owner/dataset`) reference; null when absent. */
export function kaggleRefOwner(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const owner = ref.replace(/^kaggle:\/\//, "").split("/")[0]?.trim();
  return owner ? owner : null;
}
