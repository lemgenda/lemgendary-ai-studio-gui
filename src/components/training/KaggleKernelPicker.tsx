/**
 * LemGendary AI Studio - recent Kaggle kernels of the configured account
 * (`GET /api/training/kaggle/kernels`), offered as monitor targets.
 */

import React, { useCallback, useEffect, useState } from "react";
import { fetchKaggleKernels } from "../../api/client";
import { KaggleKernelItem } from "../../api/types";

/** How many recent kernels the picker lists. */
export const KERNEL_PICKER_LIMIT = 20;

interface KaggleKernelPickerProps {
  /** Selected kernel reference (`owner/kernel-slug`). */
  value: string;
  onPick: (kernelRef: string) => void;
  disabled: boolean;
}

/** Select of the account's recent kernels with their run status, plus a reload button. */
export const KaggleKernelPicker: React.FC<KaggleKernelPickerProps> = ({ value, onPick, disabled }) => {
  const [kernels, setKernels] = useState<KaggleKernelItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);

  const loadKernels = useCallback(async () => {
    setIsLoading(true);
    // The wrapper logs failures and resolves to [] when the sidecar or Kaggle is unreachable.
    setKernels(await fetchKaggleKernels(KERNEL_PICKER_LIMIT));
    setIsLoading(false);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void loadKernels();
  }, [loadKernels]);

  const known = kernels.some((k) => k.ref === value);
  const placeholder = isLoading
    ? "Loading recent kernels..."
    : loaded && kernels.length === 0
      ? "No recent kernels (check Kaggle credentials)"
      : "Pick a recent kernel...";

  return (
    <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
      <select
        id="kaggle-monitor-kernel-select"
        className="editor-input"
        aria-label="Recent Kaggle kernels of the configured account"
        value={known ? value : ""}
        onChange={(e) => onPick(e.target.value)}
        disabled={disabled || isLoading || kernels.length === 0}
        style={{ flex: 1, padding: "8px 12px", fontSize: "13px" }}
      >
        <option value="">{placeholder}</option>
        {kernels.map((k) => (
          <option key={k.ref} value={k.ref} title={k.failure_message ?? undefined}>
            {k.title} ({k.ref}) - {k.status}
          </option>
        ))}
      </select>
      <button
        type="button"
        id="kaggle-monitor-kernels-refresh"
        className="btn btn-secondary"
        onClick={() => void loadKernels()}
        disabled={disabled || isLoading}
        style={{ padding: "8px 14px", fontSize: "13px" }}
      >
        {isLoading ? "Loading..." : "Reload Kernels"}
      </button>
    </div>
  );
};
