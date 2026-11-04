import React from "react";
import { ModelItem } from "../../api/types";

/** Isolated Kaggle variation badges (PyTorch, ONNX FP32, ONNX FP16) of a model card. */
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
    <span
      className={`badge ${m.checkpoint_exists ? "badge-success" : "badge-secondary"}`}
      style={{ fontSize: "9px", padding: "2px 6px" }}
      title="PyTorch (.pt) standalone binary in dist/kaggle/pytorch/"
    >
      PyTorch (.pt)
    </span>
    <span
      className={`badge ${m.checkpoint_exists ? "badge-success" : "badge-secondary"}`}
      style={{ fontSize: "9px", padding: "2px 6px" }}
      title="ONNX FP32 + External Tensor Data in dist/kaggle/onnx_fp32/"
    >
      ONNX FP32
    </span>
    <span
      className={`badge ${m.checkpoint_exists ? "badge-success" : "badge-secondary"}`}
      style={{ fontSize: "9px", padding: "2px 6px" }}
      title="ONNX FP16 Embedded in dist/kaggle/onnx_fp16/"
    >
      ONNX FP16
    </span>
  </div>
);
