/**
 * Bug report limits. They mirror the Environment Manager's
 * `env_manager/bug_report/config.py` and `models.py` (`POST /api/bug-report`)
 * so the form rejects what the server would reject before uploading.
 */

const MIB = 1024 * 1024;

export const BUG_REPORT_LIMITS = {
  emailMaxLength: 254,
  /** `module`, `app_version` and `current_tab`. */
  labelMinLength: 1,
  labelMaxLength: 100,
  descriptionMinLength: 50,
  descriptionMaxLength: 10_000,
  maxScreenshots: 5,
  screenshotMaxBytes: 5 * MIB,
  telemetryMaxBytes: 2 * MIB,
  recordingMaxBytes: 50 * MIB,
  totalMaxBytes: 80 * MIB,
} as const;

export const SCREENSHOT_TYPES: readonly string[] = ["image/png", "image/webp"];
export const TELEMETRY_TYPE = "text/csv";
export const RECORDING_TYPES: readonly string[] = ["video/webm", "video/mp4"];

/** Same shape as the server's `_EMAIL_RE`: local part, `@`, a dotted domain. */
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;

/** Whole MiB, as the server words its size messages ("5 MB"). */
export function formatMegabytes(bytes: number): string {
  return `${Math.floor(bytes / MIB)} MB`;
}
