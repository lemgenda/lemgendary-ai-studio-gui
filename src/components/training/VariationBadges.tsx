import React from "react";
import { ModelItem } from "../../api/types";

/** One isolated Kaggle variation and the `ModelItem` flag that says its artifact exists. */
interface VariationSpec {
  label: string;
  flag: "pytorch_ready" | "onnx_fp32_ready" | "onnx_fp16_ready";
  location: string;
}

const VARIATIONS: readonly VariationSpec[] = [
  { label: "PyTorch (.pt)", flag: "pytorch_ready", location: "Kaggle instance pytorch/fp32: standalone .pt (staged in dist/kaggle/pytorch_fp32/)" },
  { label: "ONNX FP32", flag: "onnx_fp32_ready", location: "Kaggle instance onnx/fp32: _FP32.onnx + .data sidecar (staged in dist/kaggle/onnx_fp32/)" },
  { label: "ONNX FP16", flag: "onnx_fp16_ready", location: "Kaggle instance onnx/fp16: .onnx, weights embedded (staged in dist/kaggle/onnx_fp16/)" },
];

/** Badge class and tooltip suffix for a readiness flag; `undefined` means the sidecar did not report it. */
export function variationBadgeState(ready: boolean | undefined): { badge: string; note: string } {
  if (ready === true) return { badge: "badge-success", note: "artifact present" };
  if (ready === false) return { badge: "badge-secondary", note: "artifact missing" };
  return { badge: "badge-secondary", note: "readiness not reported by the Training Suite" };
}

/** Isolated Kaggle variation badges (PyTorch, ONNX FP32, ONNX FP16) of a model card, each bound to its own artifact. */
export const VariationBadges: React.FC<{ model: ModelItem }> = ({ model: m }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "6px",
      flexWrap: "wrap",
      padding: "4px 8px",
      background: "rgba(0,0,0,0.15)",
      borderRadius: "6px",
      border: "1px solid var(--border-color)",
    }}
  >
    <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600 }}>VARIATIONS:</span>
    {VARIATIONS.map((v) => {
      const state = variationBadgeState(m[v.flag]);
      return (
        <span
          key={v.flag}
          className={`badge ${state.badge}`}
          style={{ fontSize: "9px", padding: "2px 6px" }}
          title={`${v.location} (${state.note})`}
          data-variation={v.flag}
        >
          {v.label}
        </span>
      );
    })}
  </div>
);
