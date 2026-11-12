/**
 * LemGendary AI Studio - Blend Soup dialog: pick the vault donor checkpoints
 * and their weights, or let the sidecar blend every vault checkpoint uniformly.
 */

import React, { useEffect, useState } from "react";
import { Modal } from "../common/Modal";
import { ValidationBanner } from "../common/ValidationBanner";
import { HelpTooltip } from "../HelpTooltip";
import { ModelItem } from "../../api/types";
import {
  MIN_SOUP_DONORS,
  SoupDonorDraft,
  SoupRecipe,
  buildSoupRecipe,
  defaultSoupDrafts,
  soupDonorCandidates,
} from "./soupRecipe";

type SoupMode = "all" | "pick";

interface SoupBlendDialogProps {
  model: ModelItem | null;
  onClose: () => void;
  /** `null` recipe: blend every vault checkpoint with uniform weights. */
  onBlend: (modelKey: string, recipe: SoupRecipe | null) => void;
  isBusy: boolean;
}

/** Share of one weight in the total, as a percentage label. */
function shareLabel(weight: string, drafts: readonly SoupDonorDraft[]): string {
  const total = drafts.filter((d) => d.selected).reduce((sum, d) => sum + (Number(d.weight) || 0), 0);
  const value = Number(weight);
  if (!Number.isFinite(value) || value < 0 || total <= 0) return "-";
  return `${((value / total) * 100).toFixed(1)}%`;
}

export const SoupBlendDialog: React.FC<SoupBlendDialogProps> = ({ model, onClose, onBlend, isBusy }) => {
  const [mode, setMode] = useState<SoupMode>("all");
  const [drafts, setDrafts] = useState<SoupDonorDraft[]>([]);

  // Reset to the uniform default each time the dialog opens for a model.
  useEffect(() => {
    if (!model) return;
    const candidates = soupDonorCandidates(model);
    setDrafts(defaultSoupDrafts(candidates));
    setMode(candidates.length >= MIN_SOUP_DONORS ? "pick" : "all");
  }, [model]);

  if (!model) return null;

  const canPick = drafts.length >= MIN_SOUP_DONORS;
  const result = mode === "pick" ? buildSoupRecipe(drafts) : null;
  const error = result && !result.ok ? result.error : null;

  const updateDraft = (key: string, patch: Partial<SoupDonorDraft>) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const handleBlend = () => {
    if (mode === "all") {
      onBlend(model.key, null);
    } else if (result && result.ok) {
      onBlend(model.key, result.recipe);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      id="soup-dialog"
      className="modal-content-compact"
      title={`Blend Model Soup: ${model.display_name}`}
      headerActions={
        <HelpTooltip content="Averages the weights of the model's vault checkpoints (one per SOTA metric best) into one Pareto Model Soup checkpoint. Weights are scaled to sum to 1." />
      }
      footer={
        <>
          <button id="soup-btn-cancel" type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            id="soup-btn-blend"
            type="button"
            className="btn btn-primary"
            onClick={handleBlend}
            disabled={isBusy || Boolean(error)}
          >
            {isBusy ? "Blending..." : "Blend Soup"}
          </button>
        </>
      }
    >
      <fieldset style={{ border: "none", padding: 0, margin: "0 0 12px 0", display: "flex", flexDirection: "column", gap: "6px" }}>
        <legend style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Donors</legend>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
          <input
            id="soup-mode-all"
            type="radio"
            name="soup-mode"
            checked={mode === "all"}
            onChange={() => setMode("all")}
          />
          <span>Every vault checkpoint on disk, uniform weights</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
          <input
            id="soup-mode-pick"
            type="radio"
            name="soup-mode"
            checked={mode === "pick"}
            onChange={() => setMode("pick")}
            disabled={!canPick}
          />
          <span>
            {canPick
              ? "Choose donors and weights"
              : `Choose donors and weights (needs ${MIN_SOUP_DONORS} measured SOTA metrics; this model has ${drafts.length})`}
          </span>
        </label>
      </fieldset>

      {mode === "pick" && (
        <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-muted)" }}>
              <th scope="col">Use</th>
              <th scope="col">Vault checkpoint</th>
              <th scope="col">Weight</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => (
              <tr key={d.key}>
                <td>
                  <input
                    id={`soup-donor-${d.key}`}
                    type="checkbox"
                    checked={d.selected}
                    onChange={(e) => updateDraft(d.key, { selected: e.target.checked })}
                    aria-label={`Use the ${d.label} vault checkpoint`}
                  />
                </td>
                <td>
                  {d.label} <code>vault_{d.key}.pth</code>
                </td>
                <td>
                  <input
                    id={`soup-weight-${d.key}`}
                    type="number"
                    min={0}
                    step="any"
                    className="editor-input"
                    value={d.weight}
                    onChange={(e) => updateDraft(d.key, { weight: e.target.value })}
                    disabled={!d.selected}
                    aria-label={`Weight of the ${d.label} vault checkpoint`}
                    style={{ width: "80px", padding: "4px 8px", fontSize: "12px" }}
                  />
                </td>
                <td>{d.selected ? shareLabel(d.weight, drafts) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {error && <ValidationBanner type="error" message={error} style={{ marginTop: "12px", fontSize: "12px" }} />}
    </Modal>
  );
};
