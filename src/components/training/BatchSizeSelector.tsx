import React from "react";

/** Local training batch sizes offered on a model card. */
const BATCH_SIZES = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024] as const;

interface BatchSizeSelectorProps {
  value: number;
  onChange: (batchSize: number) => void;
  disabled: boolean;
  modelName: string;
}

/** Batch size select for a local training run. */
export const BatchSizeSelector: React.FC<BatchSizeSelectorProps> = ({ value, onChange, disabled, modelName }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px",
      background: "rgba(255, 255, 255, 0.02)",
      padding: "5px 10px",
      borderRadius: "6px",
      border: "1px solid var(--border-color)",
      marginTop: "auto",
    }}
  >
    <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 600 }}>
      Batch Size:
    </span>
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
      aria-label={`Select local batch size for ${modelName}`}
      style={{
        padding: "2px 8px",
        fontSize: "11px",
        fontWeight: 700,
        borderRadius: "4px",
        background: "rgba(15, 23, 42, 0.8)",
        border: "1px solid var(--border-color)",
        color: "var(--text-primary)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {BATCH_SIZES.map((size) => (
        <option key={size} value={size}>
          {size}
        </option>
      ))}
    </select>
  </div>
);
