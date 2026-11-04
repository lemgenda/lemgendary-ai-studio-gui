import { BugReportFieldErrors, isBugReportField } from "./fields";
import { BUG_REPORT_LIMITS, formatMegabytes } from "./limits";
import { logger } from "../utils/logger";

export type BugReportErrorKind = "offline" | "validation" | "too_large" | "server";

export const ENV_MANAGER_OFFLINE_MESSAGE =
  "Environment Manager is not running. Start it from the Dashboard, then send the report again.";

/** Why a bug report was not saved, with per-field messages when the server named the field. */
export class BugReportSubmitError extends Error {
  readonly kind: BugReportErrorKind;
  readonly fieldErrors: BugReportFieldErrors;

  constructor(kind: BugReportErrorKind, message: string, fieldErrors: BugReportFieldErrors = {}) {
    super(message);
    this.name = "BugReportSubmitError";
    this.kind = kind;
    this.fieldErrors = fieldErrors;
  }

  /** The request never reached the Environment Manager (connection refused, CORS, DNS). */
  static offline(cause: unknown): BugReportSubmitError {
    logger.warn("Bug report request failed before reaching the Environment Manager", cause);
    return new BugReportSubmitError("offline", ENV_MANAGER_OFFLINE_MESSAGE);
  }
}

/**
 * FastAPI `detail` entries (`{loc: ["body", field], msg}`) as field errors.
 * Entries whose field is unknown go to `form`; a string `detail` goes to `form`.
 */
export function mapServerDetail(detail: unknown): BugReportFieldErrors {
  const errors: BugReportFieldErrors = {};
  const addError = (key: keyof BugReportFieldErrors, message: string) => {
    errors[key] = errors[key] ? `${errors[key]} ${message}` : message;
  };
  if (typeof detail === "string" && detail) {
    addError("form", detail);
    return errors;
  }
  if (!Array.isArray(detail)) return errors;
  for (const entry of detail) {
    if (typeof entry !== "object" || entry === null) continue;
    const { loc, msg } = entry as { loc?: unknown; msg?: unknown };
    const message = typeof msg === "string" && msg ? msg : "Invalid value.";
    const field = Array.isArray(loc) ? loc.find((part) => isBugReportField(part)) : undefined;
    addError(isBugReportField(field) ? field : "form", message);
  }
  return errors;
}

/** Error for a non-2xx response of `POST /api/bug-report`. */
export function bugReportErrorFromResponse(status: number, statusText: string, body: unknown): BugReportSubmitError {
  const detail = typeof body === "object" && body !== null ? (body as { detail?: unknown }).detail : undefined;
  const fieldErrors = mapServerDetail(detail);
  if (status === 413) {
    return new BugReportSubmitError(
      "too_large",
      `The report is too large. Each screenshot may be ${formatMegabytes(BUG_REPORT_LIMITS.screenshotMaxBytes)}, ` +
        `telemetry ${formatMegabytes(BUG_REPORT_LIMITS.telemetryMaxBytes)}, a recording ` +
        `${formatMegabytes(BUG_REPORT_LIMITS.recordingMaxBytes)}, and the whole report ` +
        `${formatMegabytes(BUG_REPORT_LIMITS.totalMaxBytes)}. Remove an attachment and try again.`,
      fieldErrors
    );
  }
  if (status === 422) {
    return new BugReportSubmitError("validation", "The Environment Manager rejected some fields; see the messages below.", fieldErrors);
  }
  const text = fieldErrors.form ?? `HTTP ${status} ${statusText}`.trim();
  return new BugReportSubmitError("server", `The bug report could not be saved: ${text}`);
}
