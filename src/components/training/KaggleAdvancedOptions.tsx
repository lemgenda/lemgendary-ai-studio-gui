/**
 * LemGendary AI Studio - "Advanced" group of the Kaggle launch options: clone
 * refs and session window of `POST /api/training/kaggle/train`. Every field is
 * empty by default (not sent); a refused value shows its message under the field.
 */

import React from "react";
import { HelpTooltip } from "../HelpTooltip";
import { KAGGLE_GIT_REF_MAX_LENGTH } from "../../api/types";
import { KaggleAdvancedField, KaggleAdvancedForm, advancedFormErrors } from "./kaggleAdvancedLaunch";

interface AdvancedFieldSpec {
  field: KaggleAdvancedField;
  id: string;
  label: string;
  placeholder: string;
  help: string;
  inputMode: "text" | "decimal";
}

const REF_RULES =
  `Letters, digits, '.', '_', '/' and '-' only, starting with a letter or digit, at most ${KAGGLE_GIT_REF_MAX_LENGTH} characters, ` +
  "and none of '..', '//', '@{', '/.' or a trailing '/', '.' or '.lock'.";

const ADVANCED_FIELDS: readonly AdvancedFieldSpec[] = [
  {
    field: "gitRef",
    id: "kaggle-input-git-ref",
    label: "Training Suite Ref:",
    placeholder: "main",
    help: `Branch, tag or full commit SHA the kernel clones the Training Suite at (sent as git_ref). Empty clones main. ${REF_RULES}`,
    inputMode: "text",
  },
  {
    field: "envManagerRef",
    id: "kaggle-input-env-manager-ref",
    label: "Env Manager Ref:",
    placeholder: "Same as Training Suite ref",
    help: `Ref the kernel clones the Environment Manager at (sent as env_manager_ref). Empty uses the Training Suite ref. ${REF_RULES}`,
    inputMode: "text",
  },
  {
    field: "limitHours",
    id: "kaggle-input-limit-hours",
    label: "Session Limit (h):",
    placeholder: "Config default",
    help: "Session limit in hours for this kernel, greater than 0 (sent as limit_hours). Empty uses kaggle_session.limit_hours of the Training Suite config.yaml.",
    inputMode: "decimal",
  },
  {
    field: "marginMinutes",
    id: "kaggle-input-margin-minutes",
    label: "Stop Margin (min):",
    placeholder: "Config default",
    help: "Minutes before the session limit the trainer stops and saves, 0 or more and below the limit (sent as margin_minutes). Empty uses kaggle_session.margin_minutes of the Training Suite config.yaml.",
    inputMode: "decimal",
  },
];

interface KaggleAdvancedOptionsProps {
  form: KaggleAdvancedForm;
  onChange: (form: KaggleAdvancedForm) => void;
}

export const KaggleAdvancedOptions: React.FC<KaggleAdvancedOptionsProps> = ({ form, onChange }) => {
  const errors = advancedFormErrors(form);
  return (
    <fieldset
      id="kaggle-fieldset-advanced"
      className="kaggle-advanced-fieldset"
    >
      <legend className="kaggle-advanced-legend">Advanced</legend>
      <div className="kaggle-advanced-grid">
        {ADVANCED_FIELDS.map((spec) => {
          const error = errors[spec.field];
          const errorId = `${spec.id}-error`;
          return (
            <div className="form-group" key={spec.id}>
              <div className="form-field-label-row">
                <label htmlFor={spec.id} className="form-field-label-sm">
                  {spec.label}
                </label>
                <HelpTooltip content={spec.help} />
              </div>
              <input
                id={spec.id}
                type="text"
                inputMode={spec.inputMode}
                className="editor-input form-control-lg"
                placeholder={spec.placeholder}
                value={form[spec.field]}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                onChange={(e) => onChange({ ...form, [spec.field]: e.target.value })}
              />
              {error && (
                <div id={errorId} role="alert" className="field-alert-inline">
                  {error}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
};
