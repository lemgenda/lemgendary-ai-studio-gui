/**
 * LemGendary AI Studio - preset recommendation and dataset lookup helpers.
 *
 * Single Source of Truth (SSOT) for matching dataset manifolds to their
 * canonical compiler presets across forms, hooks, and cards.
 */

import type { DatasetItem } from "../../api/types";

/**
 * Find a dataset in a catalog by key, display name, or modernized folder (case-insensitive).
 */
export function findDatasetByManifold(
  datasets: DatasetItem[],
  manifoldKey: string
): DatasetItem | undefined {
  if (!manifoldKey) return undefined;
  const lower = manifoldKey.trim().toLowerCase();
  return datasets.find(
    (d) =>
      d.key === manifoldKey ||
      d.key.toLowerCase() === lower ||
      d.display_name.toLowerCase() === lower ||
      (Boolean(d.modernized_folder) && d.modernized_folder?.toLowerCase() === lower)
  );
}

/**
 * Determine the canonical recommended compiler preset for a dataset manifold.
 */
export function getRecommendedPreset(dataset: DatasetItem | undefined): string {
  if (!dataset) return "quality-vision";
  if (dataset.recommended_preset) {
    return dataset.recommended_preset;
  }
  const task = (dataset.task || "").trim().toLowerCase();
  const format = (dataset.canonical_format || dataset.format || "").trim().toLowerCase();

  if (task === "forex" || format === "parquet") {
    return "forex-timeseries";
  }
  if (task === "ai_helper" || task === "llm" || task === "nlp" || format === "jsonl") {
    return "llm-instruction";
  }
  if (task === "detection" || task === "pose") {
    return "detection-variable";
  }
  if (task === "restoration" || task === "super-resolution" || task === "segmentation") {
    return "restoration-hardlinked";
  }
  return "quality-vision";
}
