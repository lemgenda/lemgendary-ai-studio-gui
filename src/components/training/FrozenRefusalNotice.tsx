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

const CELL_STYLE: React.CSSProperties = {
  padding: "4px 8px",
  borderBottom: "1px solid var(--border-color)",
  textAlign: "left",
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "11px",
  wordBreak: "break-all",
  verticalAlign: "top",
};

interface FrozenRefusalNoticeProps {
  report: FrozenRefusalReport;
  onDismiss: () => void;
}

export const FrozenRefusalNotice: React.FC<FrozenRefusalNoticeProps> = ({ report, onDismiss }) => (
  <div
    id="train-frozen-refusal"
    role="alert"
    className="validation-banner banner-error"
    style={{ marginBottom: "16px", display: "flex", flexDirection: "column", gap: "8px" }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
      <strong>{report.jobLabel} failed: resume refused because frozen run settings changed.</strong>
      <button
        id="train-btn-frozen-refusal-dismiss"
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss resume refusal"
        style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontWeight: 700, padding: "0 4px", fontSize: "12px", lineHeight: 1 }}
      >
        X
      </button>
    </div>
    <span id="train-frozen-refusal-message" style={{ fontSize: "12px" }}>
      {report.message}
    </span>
    {report.changes.length > 0 && (
      <table id="train-frozen-refusal-changes" style={{ borderCollapse: "collapse", width: "100%" }}>
        <caption style={{ textAlign: "left", fontSize: "12px", fontWeight: 600, paddingBottom: "4px" }}>
          Changed frozen settings
        </caption>
        <thead>
          <tr>
            <th scope="col" style={CELL_STYLE}>Setting</th>
            <th scope="col" style={CELL_STYLE}>Run started with</th>
            <th scope="col" style={CELL_STYLE}>Configured now</th>
          </tr>
        </thead>
        <tbody>
          {report.changes.map((change) => (
            <tr key={change.key}>
              <td style={CELL_STYLE}>{change.key}</td>
              <td style={CELL_STYLE}>{change.old}</td>
              <td style={CELL_STYLE}>{change.new}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
    <span id="train-frozen-refusal-hint" style={{ fontSize: "12px" }}>
      {frozenRefusalHint(report.launch)}
    </span>
  </div>
);
