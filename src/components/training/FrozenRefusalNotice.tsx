/**
 * LemGendary AI Studio - error region for a training job the Training Suite refused
 * to resume because frozen run settings changed: the refusal message, the changed
 * settings and where to enable the override for the next launch.
 */

import React from "react";
import { FrozenRefusal } from "./frozenRefusal";
import { OVERRIDE_FROZEN_LABEL } from "./OverrideFrozenToggle";

/** Which launch was refused; it decides where the override toggle is. */
export type FrozenRefusalLaunch = "local" | "kaggle";

export interface FrozenRefusalReport extends FrozenRefusal {
  launch: FrozenRefusalLaunch;
  /** Names the job, for example "Local training job job-1". */
  jobLabel: string;
}

const TOGGLE_LOCATION: Record<FrozenRefusalLaunch, string> = {
  local: "on the model card and start Local Training again",
  kaggle: "in the Kaggle launch options of the Cloud Training dialog and launch again",
};

/** Next-step text for a refused launch. */
export function frozenRefusalHint(launch: FrozenRefusalLaunch): string {
  return (
    `To resume with the new settings, check "${OVERRIDE_FROZEN_LABEL}" ${TOGGLE_LOCATION[launch]}; ` +
    "the change is logged and recorded in settings_changes.jsonl. To keep the old settings, restore them in the config. " +
    "A fresh run (--clean) starts over."
  );
}

interface FrozenRefusalNoticeProps {
  report: FrozenRefusalReport;
  onDismiss: () => void;
}

export const FrozenRefusalNotice: React.FC<FrozenRefusalNoticeProps> = ({ report, onDismiss }) => (
  <div
    id="train-frozen-refusal"
    role="alert"
    className="validation-banner banner-error frozen-refusal-banner"
  >
    <div className="frozen-refusal-header">
      <strong>{report.jobLabel} failed: resume refused because frozen run settings changed.</strong>
      <button
        id="train-btn-frozen-refusal-dismiss"
        type="button"
        className="btn-dismiss-icon"
        onClick={onDismiss}
        aria-label="Dismiss resume refusal"
      >
        X
      </button>
    </div>
    <span id="train-frozen-refusal-message" className="frozen-refusal-text">
      {report.message}
    </span>
    {report.changes.length > 0 && (
      <table id="train-frozen-refusal-changes" className="frozen-refusal-table">
        <caption className="frozen-refusal-caption">
          Changed frozen settings
        </caption>
        <thead>
          <tr>
            <th scope="col" className="frozen-refusal-cell">Setting</th>
            <th scope="col" className="frozen-refusal-cell">Run started with</th>
            <th scope="col" className="frozen-refusal-cell">Configured now</th>
          </tr>
        </thead>
        <tbody>
          {report.changes.map((change) => (
            <tr key={change.key}>
              <td className="frozen-refusal-cell">{change.key}</td>
              <td className="frozen-refusal-cell">{change.old}</td>
              <td className="frozen-refusal-cell">{change.new}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
    <span id="train-frozen-refusal-hint" className="frozen-refusal-text">
      {frozenRefusalHint(report.launch)}
    </span>
  </div>
);
