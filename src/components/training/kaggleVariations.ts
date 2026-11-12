/**
 * LemGendary AI Studio - display text of the Kaggle Model Instances. The keys
 * are the Training Suite `VariationKey` enum (`VARIATION_KEYS`); labels and
 * payloads follow `training/cloud/variations.py`.
 */

import { VARIATION_KEYS, VariationChoice, VariationKey } from "../../api/types";

export interface VariationDisplay {
  label: string;
  /** What the instance holds. */
  payload: string;
}

export const VARIATION_DISPLAY: Record<VariationKey, VariationDisplay> = {
  "pytorch/default": { label: "PyTorch Checkpoints", payload: "checkpoints/*.pth, README.md, metrics.csv" },
  "pytorch/fp32": { label: "PyTorch FP32", payload: ".pt standalone model" },
  "onnx/fp16": { label: "ONNX FP16", payload: ".onnx, weights embedded" },
  "onnx/fp32": { label: "ONNX FP32", payload: "_FP32.onnx + .data sidecar" },
};

/** Options of a variation select: every instance, then each one alone. */
export const VARIATION_CHOICES: readonly { value: VariationChoice; label: string }[] = [
  { value: "all", label: `All Variations (${VARIATION_KEYS.join(", ")})` },
  ...VARIATION_KEYS.map((key) => ({ value: key, label: `${key}: ${VARIATION_DISPLAY[key].label} (${VARIATION_DISPLAY[key].payload})` })),
];

/** The select value as a `VariationChoice`; anything else reads as "all". */
export function toVariationChoice(value: string): VariationChoice {
  return VARIATION_CHOICES.find((c) => c.value === value)?.value ?? "all";
}
