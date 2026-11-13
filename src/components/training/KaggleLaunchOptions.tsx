/**
 * LemGendary AI Studio - Kaggle cloud launch options: accelerator (from the
 * Training Suite or the ecosystem snapshot), first poll interval, auto-pull and
 * the session auto-resume chain (`auto_resume`, `max_resumes`), the frozen
 * settings override (`override_frozen`) and the Advanced group (clone refs and
 * session window, see ./kaggleAdvancedLaunch).
 */

import React from "react";
import { HelpTooltip } from "../HelpTooltip";
import { OverrideFrozenToggle } from "./OverrideFrozenToggle";
import { KaggleAdvancedOptions } from "./KaggleAdvancedOptions";
import {
  DEFAULT_KAGGLE_ADVANCED_FORM,
  KaggleAdvancedFields,
  KaggleAdvancedForm,
  advancedLaunchFields,
} from "./kaggleAdvancedLaunch";
import { KaggleAcceleratorChoices } from "../../api/client";
import { KAGGLE_MAX_RESUMES_MIN, KAGGLE_POLL_DEFAULT_SECONDS, KAGGLE_POLL_MIN_SECONDS } from "../../api/types";

/** What the launch sends besides the model key. */
export interface KaggleLaunchSettings {
  /** Accelerator id; "" = the backend default accelerator. */
  accelerator: string;
  autoPull: boolean;
  /** Seconds; at least `KAGGLE_POLL_MIN_SECONDS`. */
  pollInterval: number;
  /** Push a new kernel version when a session stops at its Kaggle deadline. */
  autoResume: boolean;
  /** Resume limit of this job; null = `kaggle_session.max_resumes` of the Training Suite config. */
  maxResumes: number | null;
  /** Resume although a frozen run setting changed (every resume session of the job too). */
  overrideFrozen: boolean;
  /** Clone refs and session window; only the fields the user set (empty = not sent). */
  advanced: KaggleAdvancedFields;
}

/** What attaching to a running kernel sends (no accelerator, no resume chain). */
export type KaggleMonitorSettings = Pick<KaggleLaunchSettings, "autoPull" | "pollInterval">;

/** Form state: the poll interval stays text while typing and is parsed on launch. */
export interface KaggleLaunchForm {
  accelerator: string;
  autoPull: boolean;
  pollIntervalText: string;
  autoResume: boolean;
  /** "" = the Training Suite config default. */
  maxResumesText: string;
  overrideFrozen: boolean;
  advanced: KaggleAdvancedForm;
}

export const DEFAULT_KAGGLE_LAUNCH_FORM: KaggleLaunchForm = {
  accelerator: "",
  autoPull: true,
  pollIntervalText: String(KAGGLE_POLL_DEFAULT_SECONDS),
  autoResume: false,
  maxResumesText: "",
  overrideFrozen: false,
  advanced: DEFAULT_KAGGLE_ADVANCED_FORM,
};

/** Poll interval typed by the user, clamped to the backend minimum; default when not a number. */
export function parsePollInterval(text: string): number {
  const value = Math.round(Number(text));
  if (!Number.isFinite(value) || text.trim() === "") return KAGGLE_POLL_DEFAULT_SECONDS;
  return Math.max(KAGGLE_POLL_MIN_SECONDS, value);
}

/** Resume limit typed by the user (at least the backend minimum); null when empty or not a number. */
export function parseMaxResumes(text: string): number | null {
  const value = Math.round(Number(text));
  if (!Number.isFinite(value) || text.trim() === "") return null;
  return Math.max(KAGGLE_MAX_RESUMES_MIN, value);
}

/** Launch settings of a form; an unset accelerator takes the listed default. */
export function launchSettings(form: KaggleLaunchForm, choices: KaggleAcceleratorChoices | null): KaggleLaunchSettings {
  return {
    accelerator: form.accelerator || choices?.list.default || "",
    autoPull: form.autoPull,
    pollInterval: parsePollInterval(form.pollIntervalText),
    autoResume: form.autoResume,
    maxResumes: form.autoResume ? parseMaxResumes(form.maxResumesText) : null,
    overrideFrozen: form.overrideFrozen,
    advanced: advancedLaunchFields(form.advanced),
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

      <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-primary)", cursor: "pointer", userSelect: "none" }}>
          <input
            id="kaggle-auto-resume-checkbox"
            type="checkbox"
            checked={form.autoResume}
            onChange={(e) => onChange({ ...form, autoResume: e.target.checked })}
            style={{ cursor: "pointer", width: "16px", height: "16px" }}
          />
          <span>Auto-resume after the session deadline</span>
        </label>
        <HelpTooltip content="When a Kaggle session stops at its time limit (progress saved and synced to the Hub), the Training Suite pushes a new kernel version that resumes from the Hub. Unchecked sends auto_resume false for this job." />
      </div>

      <div className="form-group">
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
          <label htmlFor="kaggle-max-resumes-input" style={LABEL_STYLE}>
            Max Resumes:
          </label>
          <HelpTooltip content={`Most resume sessions this job pushes (minimum ${KAGGLE_MAX_RESUMES_MIN}). Empty uses kaggle_session.max_resumes of the Training Suite config.yaml.`} />
        </div>
        <input
          id="kaggle-max-resumes-input"
          type="number"
          className="editor-input"
          min={KAGGLE_MAX_RESUMES_MIN}
          step={1}
          placeholder="Config default"
          value={form.maxResumesText}
          disabled={!form.autoResume}
          onChange={(e) => onChange({ ...form, maxResumesText: e.target.value })}
          style={{ width: "100%", padding: "8px 12px", fontSize: "13px" }}
        />
      </div>

      <OverrideFrozenToggle
        id="kaggle-override-frozen-checkbox"
        checked={form.overrideFrozen}
        onChange={(overrideFrozen) => onChange({ ...form, overrideFrozen })}
        style={{ alignSelf: "center" }}
      />

      <KaggleAdvancedOptions form={form.advanced} onChange={(advanced) => onChange({ ...form, advanced })} />
    </div>
  );
};
