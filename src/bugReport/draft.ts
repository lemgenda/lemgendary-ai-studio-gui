import { BUG_REPORT_LIMITS, EMAIL_PATTERN, RECORDING_TYPES, SCREENSHOT_TYPES, formatMegabytes } from "./limits";
import { BugReportFieldErrors } from "./fields";

/** Everything the user entered or attached, before it becomes multipart form data. */
export interface BugReportDraft {
  email: string;
  module: string;
  appVersion: string;
  currentTab: string;
  description: string;
  screenshots: readonly Blob[];
  /** Telemetry CSV text, or null when the user unticked "Attach telemetry". */
  telemetryCsv: string | null;
  /** Screen recording; filled by the recording slot, null until then. */
  recording: Blob | null;
}

function checkLabel(value: string, name: string): string | undefined {
  const length = value.trim().length;
  if (length < BUG_REPORT_LIMITS.labelMinLength) return `${name} is required.`;
  if (length > BUG_REPORT_LIMITS.labelMaxLength) {
    return `${name} must be at most ${BUG_REPORT_LIMITS.labelMaxLength} characters.`;
  }
  return undefined;
}

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

function checkEmail(value: string): string | undefined {
  const email = value.trim();
  if (!email) return "Email is required.";
  if (email.length > BUG_REPORT_LIMITS.emailMaxLength) {
    return `Email must be at most ${BUG_REPORT_LIMITS.emailMaxLength} characters.`;
  }
  return EMAIL_PATTERN.test(email) ? undefined : "Enter a valid email address.";
}

function checkDescription(value: string): string | undefined {
  const length = value.trim().length;
  if (length < BUG_REPORT_LIMITS.descriptionMinLength) {
    return `Description must be at least ${BUG_REPORT_LIMITS.descriptionMinLength} characters (${length} given).`;
  }
  if (length > BUG_REPORT_LIMITS.descriptionMaxLength) {
    return `Description must be at most ${BUG_REPORT_LIMITS.descriptionMaxLength} characters.`;
  }
  return undefined;
}

function checkScreenshots(screenshots: readonly Blob[]): string | undefined {
  if (screenshots.length > BUG_REPORT_LIMITS.maxScreenshots) {
    return `At most ${BUG_REPORT_LIMITS.maxScreenshots} screenshots are allowed.`;
  }
  if (screenshots.some((shot) => !SCREENSHOT_TYPES.includes(shot.type))) {
    return `Screenshots must be ${SCREENSHOT_TYPES.join(" or ")}.`;
  }
  if (screenshots.some((shot) => shot.size > BUG_REPORT_LIMITS.screenshotMaxBytes)) {
    return `Each screenshot must be at most ${formatMegabytes(BUG_REPORT_LIMITS.screenshotMaxBytes)}.`;
  }
  return undefined;
}

function checkRecording(recording: Blob | null): string | undefined {
  if (!recording) return undefined;
  if (!RECORDING_TYPES.includes(recording.type)) {
    return `The recording must be ${RECORDING_TYPES.join(" or ")}.`;
  }
  if (recording.size > BUG_REPORT_LIMITS.recordingMaxBytes) {
    return `The recording must be at most ${formatMegabytes(BUG_REPORT_LIMITS.recordingMaxBytes)}.`;
  }
  return undefined;
}

/**
 * Client-side checks with the server's limits, keyed by multipart field.
 * Returns an empty object when the draft can be sent.
 */
export function validateBugReportDraft(draft: BugReportDraft): BugReportFieldErrors {
  const telemetryBytes = draft.telemetryCsv === null ? 0 : utf8Length(draft.telemetryCsv);
  const checks: BugReportFieldErrors = {
    email: checkEmail(draft.email),
    module: checkLabel(draft.module, "Module"),
    app_version: checkLabel(draft.appVersion, "App version"),
    current_tab: checkLabel(draft.currentTab, "Current tab"),
    description: checkDescription(draft.description),
    screenshot: checkScreenshots(draft.screenshots),
    telemetry:
      telemetryBytes > BUG_REPORT_LIMITS.telemetryMaxBytes
        ? `Telemetry must be at most ${formatMegabytes(BUG_REPORT_LIMITS.telemetryMaxBytes)}.`
        : undefined,
    recording: checkRecording(draft.recording),
  };
  const total =
    draft.screenshots.reduce((sum, shot) => sum + shot.size, 0) + telemetryBytes + (draft.recording?.size ?? 0);
  if (total > BUG_REPORT_LIMITS.totalMaxBytes) {
    checks.form = `The report must be at most ${formatMegabytes(BUG_REPORT_LIMITS.totalMaxBytes)} in total.`;
  }
  const errors: BugReportFieldErrors = {};
  for (const [field, message] of Object.entries(checks) as [keyof BugReportFieldErrors, string | undefined][]) {
    if (message) errors[field] = message;
  }
  return errors;
}

export function hasFieldErrors(errors: BugReportFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
