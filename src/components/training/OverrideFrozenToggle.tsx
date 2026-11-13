/**
 * LemGendary AI Studio - "Override frozen settings" checkbox of a training launch
 * (Training Suite `override_frozen`, `--override-frozen`). One label and help text
 * for the local launch on the model card and the Kaggle launch options.
 */

import React from "react";
import { HelpTooltip } from "../HelpTooltip";

export const OVERRIDE_FROZEN_LABEL = "Override frozen settings";

export const OVERRIDE_FROZEN_HELP =
  "A resume is refused when a frozen run setting (model class and kwargs, optimizer type, datasets, " +
  "quality scheme, subset seed, precision) differs from the one the run started with. Checked sends " +
  "override_frozen: the run resumes anyway, and the Training Suite logs the change and records it in " +
  "LemGendaryModels/<model>/settings_changes.jsonl. Unchecked (default) keeps the refusal.";

interface OverrideFrozenToggleProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name suffix, for example the model name on a card. */
  context?: string;
  style?: React.CSSProperties;
}

export const OverrideFrozenToggle: React.FC<OverrideFrozenToggleProps> = ({ id, checked, onChange, disabled = false, context, style }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "8px", ...style }}>
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "12px",
        color: "var(--text-primary)",
        cursor: disabled ? "not-allowed" : "pointer",
        userSelect: "none",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={context ? `${OVERRIDE_FROZEN_LABEL} for ${context}` : undefined}
        style={{ cursor: disabled ? "not-allowed" : "pointer", width: "16px", height: "16px" }}
      />
      <span>{OVERRIDE_FROZEN_LABEL}</span>
    </label>
    <HelpTooltip content={OVERRIDE_FROZEN_HELP} />
  </div>
);
