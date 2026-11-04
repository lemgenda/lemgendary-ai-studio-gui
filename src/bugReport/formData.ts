import { BugReportDraft } from "./draft";
import { BugReportTextField } from "./fields";
import { TELEMETRY_TYPE } from "./limits";

const SCREENSHOT_EXTENSIONS: Record<string, string> = { "image/png": "png", "image/webp": "webp" };
const RECORDING_EXTENSIONS: Record<string, string> = { "video/webm": "webm", "video/mp4": "mp4" };

/** Multipart body for `POST /api/bug-report`; text fields are trimmed like the server does. */
export function buildBugReportFormData(draft: BugReportDraft): FormData {
  const form = new FormData();
  const text: Record<BugReportTextField, string> = {
    email: draft.email.trim(),
    module: draft.module.trim(),
    app_version: draft.appVersion.trim(),
    current_tab: draft.currentTab.trim(),
    description: draft.description.trim(),
  };
  for (const [name, value] of Object.entries(text)) {
    form.append(name, value);
  }
  draft.screenshots.forEach((shot, index) => {
    form.append("screenshot", shot, `screenshot_${index + 1}.${SCREENSHOT_EXTENSIONS[shot.type] ?? "png"}`);
  });
  if (draft.telemetryCsv !== null) {
    form.append("telemetry", new Blob([draft.telemetryCsv], { type: TELEMETRY_TYPE }), "telemetry.csv");
  }
  if (draft.recording) {
    form.append("recording", draft.recording, `recording.${RECORDING_EXTENSIONS[draft.recording.type] ?? "webm"}`);
  }
  return form;
}
