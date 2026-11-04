/**
 * Multipart field names of `POST /api/bug-report` (Environment Manager
 * `BugReportFields` plus the file parts). Form building, validation and
 * server error mapping all use these names.
 */

export const BUG_REPORT_TEXT_FIELDS = ["email", "module", "app_version", "current_tab", "description"] as const;
export const BUG_REPORT_FILE_FIELDS = ["screenshot", "telemetry", "recording"] as const;

export type BugReportTextField = (typeof BUG_REPORT_TEXT_FIELDS)[number];
export type BugReportFileField = (typeof BUG_REPORT_FILE_FIELDS)[number];
export type BugReportField = BugReportTextField | BugReportFileField;

/** Field errors keyed by multipart field name; `form` holds errors without a field. */
export type BugReportFieldErrors = Partial<Record<BugReportField | "form", string>>;

export function isBugReportField(value: unknown): value is BugReportField {
  return (
    typeof value === "string" &&
    ((BUG_REPORT_TEXT_FIELDS as readonly string[]).includes(value) ||
      (BUG_REPORT_FILE_FIELDS as readonly string[]).includes(value))
  );
}
