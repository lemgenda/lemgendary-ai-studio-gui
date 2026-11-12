/**
 * LemGendary AI Studio - Kaggle URLs for a model, built from the backend handles
 * (registry slug and dataset URLs from the Training Suite) and the account owner
 * that the Kaggle credentials report (never a hardcoded owner slug).
 */

import type { ModelKaggleHandles } from "../../api/modelCatalog";

/** Suffix of a model's training kernel slug (`training/cloud/kernel_bundle.py`). */
export const KERNEL_SLUG_SUFFIX = "-training";

export interface KaggleModelLinks {
  /** `code/<owner>/<registry slug>-training`: the kernel the GUI launch pushes. */
  notebookUrl: string;
  /** `models/<owner>/<registry slug>`. */
  modelHubUrl: string;
  /** The model's Kaggle dataset URLs as the Training Suite serves them. */
  datasetUrls: string[];
}

/** Links for a model under `owner`; null while the owner or the handles are unknown. */
export function kaggleModelLinks(owner: string | null | undefined, handles: ModelKaggleHandles | null): KaggleModelLinks | null {
  const user = owner?.trim();
  if (!user || !handles) return null;
  const encodedUser = encodeURIComponent(user);
  return {
    notebookUrl: `https://www.kaggle.com/code/${encodedUser}/${handles.slug}${KERNEL_SLUG_SUFFIX}`,
    modelHubUrl: `https://www.kaggle.com/models/${encodedUser}/${handles.slug}`,
    datasetUrls: handles.datasetUrls,
  };
}

/** Owner part of a `kaggle://owner/dataset` (or `owner/dataset`) reference; null when absent. */
export function kaggleRefOwner(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const owner = ref.replace(/^kaggle:\/\//, "").split("/")[0]?.trim();
  return owner ? owner : null;
}

/** True for a Kaggle kernel reference of the form `owner/kernel-slug`. */
export function isKernelSlug(value: string): boolean {
  return /^[^/\s]+\/[^/\s]+$/.test(value.trim());
}
