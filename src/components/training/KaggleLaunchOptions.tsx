/**
 * LemGendary AI Studio - Kaggle cloud launch options: accelerator (from the
 * Training Suite or the ecosystem snapshot), first poll interval and auto-pull.
 */

import React from "react";
import { HelpTooltip } from "../HelpTooltip";
import { KaggleAcceleratorChoices } from "../../api/client";
import { KAGGLE_POLL_DEFAULT_SECONDS, KAGGLE_POLL_MIN_SECONDS } from "../../api/types";

/** What the launch sends besides the model key. */
export interface KaggleLaunchSettings {
  /** Accelerator id; "" = the backend default accelerator. */
  accelerator: string;
  autoPull: boolean;
  /** Seconds; at least `KAGGLE_POLL_MIN_SECONDS`. */
  pollInterval: number;
}

/** Form state: the poll interval stays text while typing and is parsed on launch. */
export interface KaggleLaunchForm {
  accelerator: string;
  autoPull: boolean;
  pollIntervalText: string;
}

export const DEFAULT_KAGGLE_LAUNCH_FORM: KaggleLaunchForm = {
  accelerator: "",
  autoPull: true,
  pollIntervalText: String(KAGGLE_POLL_DEFAULT_SECONDS),
};

/** Poll interval typed by the user, clamped to the backend minimum; default when not a number. */
export function parsePollInterval(text: string): number {
  const value = Math.round(Number(text));
  if (!Number.isFinite(value) || text.trim() === "") return KAGGLE_POLL_DEFAULT_SECONDS;
  return Math.max(KAGGLE_POLL_MIN_SECONDS, value);
}

/** Launch settings of a form; an unset accelerator takes the listed default. */
export function launchSettings(form: KaggleLaunchForm, choices: KaggleAcceleratorChoices | null): KaggleLaunchSettings {
  return {
    accelerator: form.accelerator || choices?.list.default || "",
    autoPull: form.autoPull,
    pollInterval: parsePollInterval(form.pollIntervalText),
  };
}

interface KaggleLaunchOptionsProps {
  choices: KaggleAcceleratorChoices | null;
  form: KaggleLaunchForm;
  onChange: (form: KaggleLaunchForm) => void;
}

const LABEL_STYLE: React.CSSProperties = { fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" };

export const KaggleLaunchOptions: React.FC<KaggleLaunchOptionsProps> = ({ choices, form, onChange }) => {
  const accelerators = choices?.list.accelerators ?? [];
  const selected = form.accelerator || choices?.list.default || "";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" }}>
      <div className="form-group">
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
          <label htmlFor="kaggle-accelerator-select" style={LABEL_STYLE}>
            Kaggle Accelerator:
          </label>
          <HelpTooltip content="Kaggle session type from the ecosystem accelerator table (retired machine shapes are not offered). Sent as the accelerator id; the Training Suite maps it to the Kaggle machine shape." />
        </div>
        <select
          id="kaggle-accelerator-select"
          className="editor-select"
          value={selected}
          onChange={(e) => onChange({ ...form, accelerator: e.target.value })}
          disabled={accelerators.length === 0}
          style={{ width: "100%", padding: "8px 12px", fontSize: "13px" }}
        >
          {accelerators.length === 0 && <option value="">Loading accelerators...</option>}
          {accelerators.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.label}
              {acc.id === choices?.list.default ? " (default)" : ""}
            </option>
          ))}
        </select>
        {choices?.source === "snapshot" && (
          <div id="kaggle-accelerator-source" style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
            Training Suite offline: list from the ecosystem snapshot.
          </div>
        )}
      </div>

      <div className="form-group">
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
          <label htmlFor="kaggle-poll-interval-input" style={LABEL_STYLE}>
            Poll Interval (s):
          </label>
          <HelpTooltip content={`First status poll interval in seconds (minimum ${KAGGLE_POLL_MIN_SECONDS}, default ${KAGGLE_POLL_DEFAULT_SECONDS}). The Training Suite backs off to 300 s while the kernel status is unchanged.`} />
        </div>
        <input
          id="kaggle-poll-interval-input"
          type="number"
          className="editor-input"
          min={KAGGLE_POLL_MIN_SECONDS}
          step={1}
          value={form.pollIntervalText}
          onChange={(e) => onChange({ ...form, pollIntervalText: e.target.value })}
          style={{ width: "100%", padding: "8px 12px", fontSize: "13px" }}
        />
      </div>

      <div className="form-group" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingBottom: "8px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-primary)", cursor: "pointer", userSelect: "none" }}>
            <input
              id="kaggle-auto-pull-checkbox"
              type="checkbox"
              checked={form.autoPull}
              onChange={(e) => onChange({ ...form, autoPull: e.target.checked })}
              style={{ cursor: "pointer", width: "16px", height: "16px" }}
            />
            <span>Auto-pull to LemGendaryModels</span>
          </label>
          <HelpTooltip content="Pulls pytorch/default whenever the Kaggle Hub has a newer version, and merges the kernel output (checkpoints, README.md, metrics.csv) when the session completes." />
        </div>
      </div>
    </div>
  );
};
