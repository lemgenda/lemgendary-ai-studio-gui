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
  className?: string;
}

export const OverrideFrozenToggle: React.FC<OverrideFrozenToggleProps> = ({ id, checked, onChange, disabled = false, context, className = "" }) => (
  <div className={`override-frozen-row ${className}`}>
    <label className={`checkbox-label ${disabled ? "checkbox-label-disabled" : ""}`}>
      <input
        id={id}
        type="checkbox"
        className={disabled ? "checkbox-input-lg-disabled" : "checkbox-input-lg"}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={context ? `${OVERRIDE_FROZEN_LABEL} for ${context}` : undefined}
      />
      <span>{OVERRIDE_FROZEN_LABEL}</span>
    </label>
    <HelpTooltip content={OVERRIDE_FROZEN_HELP} />
  </div>
);
