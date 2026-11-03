import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "../common/Modal";
import { ScreenshotAnnotator } from "./ScreenshotAnnotator";
import { ScreenshotAttachment, ScreenshotStrip } from "./ScreenshotStrip";
import { RecordingSlot } from "./RecordingSlot";
import { BugReportSuccess } from "./BugReportSuccess";
import { useStudioStore } from "../../store/useStudioStore";
import { submitBugReport } from "../../api/client";
import { BugReportResponse } from "../../api/types";
import { APP_VERSION } from "../../appVersion";
import { WORKSPACE_TABS, workspaceTabLabel } from "../../navigation/workspaceTabs";
import { BUG_REPORT_LIMITS } from "../../bugReport/limits";
import { BugReportDraft, hasFieldErrors, validateBugReportDraft } from "../../bugReport/draft";
import { BugReportFieldErrors } from "../../bugReport/fields";
import { buildBugReportFormData } from "../../bugReport/formData";
import { buildTelemetryCsv } from "../../bugReport/telemetryCsv";
import { BugReportSubmitError } from "../../bugReport/serverErrors";
import { CAPTURE_EXCLUDE_PROPS, ScreenCapturer, captureAppScreen } from "../../bugReport/screenshotCapture";

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Sends the multipart body; defaults to the Environment Manager client. */
  submit?: (form: FormData) => Promise<BugReportResponse>;
  /** Renders the app into a canvas; defaults to the DOM capture. */
  captureScreen?: ScreenCapturer;
}

interface FormState {
  email: string;
  moduleTabId: string;
  description: string;
  attachTelemetry: boolean;
  screenshots: ScreenshotAttachment[];
  recording: Blob | null;
}

const emptyForm = (currentTab: string): FormState => ({
  email: "",
  moduleTabId: currentTab,
  description: "",
  attachTelemetry: true,
  screenshots: [],
  recording: null,
});

/** Accessible error paragraph for one field; `undefined` renders nothing. */
const FieldError: React.FC<{ id: string; message?: string }> = ({ id, message }) =>
  message ? (
    <p id={id} className="field-error" role="alert">
      {message}
    </p>
  ) : null;

/**
 * Report Issue modal: collects the report, checks it against the server's
 * limits, sends it to the Environment Manager and shows where the ZIP was saved.
 */
export const BugReportModal: React.FC<BugReportModalProps> = ({
  isOpen,
  onClose,
  submit = submitBugReport,
  captureScreen = captureAppScreen,
}) => {
  const currentTab = useStudioStore((s) => s.currentTab);
  const events = useStudioStore((s) => s.events);

  const [form, setForm] = useState<FormState>(() => emptyForm(currentTab));
  const [fieldErrors, setFieldErrors] = useState<BugReportFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<BugReportResponse | null>(null);
  const [isAnnotating, setIsAnnotating] = useState<boolean>(false);
  const requestRef = useRef(0);
  const nextScreenshotId = useRef(0);

  // Preselect the module from the active tab whenever the modal opens.
  useEffect(() => {
    if (isOpen) setForm((prev) => ({ ...prev, moduleTabId: currentTab }));
  }, [isOpen, currentTab]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleClose = useCallback(() => {
    requestRef.current += 1;
    setForm(emptyForm(currentTab));
    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(false);
    setResult(null);
    setIsAnnotating(false);
    onClose();
  }, [currentTab, onClose]);

  const buildDraft = (): BugReportDraft => ({
    email: form.email,
    module: workspaceTabLabel(form.moduleTabId),
    appVersion: APP_VERSION,
    currentTab,
    description: form.description,
    screenshots: form.screenshots.map((shot) => shot.blob),
    telemetryCsv: form.attachTelemetry ? buildTelemetryCsv(events) : null,
    recording: form.recording,
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = buildDraft();
    const errors = validateBugReportDraft(draft);
    setFieldErrors(errors);
    setFormError(errors.form ?? null);
    if (hasFieldErrors(errors)) return;

    const request = requestRef.current + 1;
    requestRef.current = request;
    setIsSubmitting(true);
    try {
      const response = await submit(buildBugReportFormData(draft));
      if (requestRef.current !== request) return;
      setResult(response);
    } catch (err: unknown) {
      if (requestRef.current !== request) return;
      if (err instanceof BugReportSubmitError) {
        setFieldErrors(err.fieldErrors);
        setFormError(err.message);
      } else {
        console.error("Bug report submission failed:", err);
        setFormError(`The bug report could not be sent: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      if (requestRef.current === request) setIsSubmitting(false);
    }
  };

  const addScreenshot = (blob: Blob) => {
    nextScreenshotId.current += 1;
    const id = `shot-${nextScreenshotId.current}`;
    setForm((prev) =>
      prev.screenshots.length >= BUG_REPORT_LIMITS.maxScreenshots
        ? prev
        : { ...prev, screenshots: [...prev.screenshots, { id, blob }] }
    );
    setIsAnnotating(false);
  };

  const descriptionLength = form.description.trim().length;
  const otherFieldError = [fieldErrors.app_version, fieldErrors.current_tab, fieldErrors.telemetry]
    .filter(Boolean)
    .join(" ");

  const footer = result ? (
    <button id="bug-modal-btn-done" type="button" className="btn btn-primary" onClick={handleClose}>
      Done
    </button>
  ) : (
    <>
      <button id="bug-modal-btn-cancel" type="button" className="btn btn-secondary" onClick={handleClose}>
        Cancel
      </button>
      <button
        id="bug-modal-btn-submit"
        type="submit"
        form="bug-modal-form"
        className="btn btn-primary"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? "Sending..." : "Send report"}
      </button>
    </>
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        id="bug-modal-dialog"
        title={result ? "Report saved" : "Report Issue"}
        className="modal-content-form"
        backdropAttributes={CAPTURE_EXCLUDE_PROPS}
        footer={footer}
      >
        {result ? (
          <BugReportSuccess result={result} />
        ) : (
          <form id="bug-modal-form" className="bug-report-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
            {formError && (
              <p id="bug-modal-error" className="field-error" role="alert">
                {formError}
              </p>
            )}

            <div className="form-field">
              <label htmlFor="bug-modal-email">Your email</label>
              <input
                id="bug-modal-email"
                type="email"
                className="form-input"
                value={form.email}
                maxLength={BUG_REPORT_LIMITS.emailMaxLength}
                autoComplete="email"
                onChange={(e) => update("email", e.target.value)}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "bug-modal-email-error" : undefined}
              />
              <FieldError id="bug-modal-email-error" message={fieldErrors.email} />
            </div>

            <div className="form-field">
              <label htmlFor="bug-modal-module">Module</label>
              <select
                id="bug-modal-module"
                className="editor-select"
                value={form.moduleTabId}
                onChange={(e) => update("moduleTabId", e.target.value)}
                aria-invalid={Boolean(fieldErrors.module)}
                aria-describedby={fieldErrors.module ? "bug-modal-module-error" : undefined}
              >
                {WORKSPACE_TABS.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
              <FieldError id="bug-modal-module-error" message={fieldErrors.module} />
            </div>

            <div className="form-field">
              <label htmlFor="bug-modal-description">What happened?</label>
              <textarea
                id="bug-modal-description"
                className="form-input bug-description"
                rows={6}
                value={form.description}
                maxLength={BUG_REPORT_LIMITS.descriptionMaxLength}
                onChange={(e) => update("description", e.target.value)}
                aria-invalid={Boolean(fieldErrors.description)}
                aria-describedby={
                  fieldErrors.description ? "bug-modal-description-counter bug-modal-description-error" : "bug-modal-description-counter"
                }
              />
              <p
                id="bug-modal-description-counter"
                className={descriptionLength < BUG_REPORT_LIMITS.descriptionMinLength ? "field-hint field-hint-warning" : "field-hint"}
              >
                {descriptionLength} / {BUG_REPORT_LIMITS.descriptionMaxLength} characters (at least{" "}
                {BUG_REPORT_LIMITS.descriptionMinLength})
              </p>
              <FieldError id="bug-modal-description-error" message={fieldErrors.description} />
            </div>

            <div className="bug-checkbox-row">
              <input
                id="bug-modal-telemetry"
                type="checkbox"
                checked={form.attachTelemetry}
                onChange={(e) => update("attachTelemetry", e.target.checked)}
              />
              <label htmlFor="bug-modal-telemetry">Attach telemetry ({events.length} recent events as CSV)</label>
            </div>

            <ScreenshotStrip
              screenshots={form.screenshots}
              onAdd={() => setIsAnnotating(true)}
              onRemove={(id) => update("screenshots", form.screenshots.filter((shot) => shot.id !== id))}
              error={fieldErrors.screenshot}
            />

            <RecordingSlot
              available={false}
              recording={form.recording}
              onRecordingChange={(recording) => update("recording", recording)}
              error={fieldErrors.recording}
            />

            <FieldError id="bug-modal-other-error" message={otherFieldError || undefined} />
          </form>
        )}
      </Modal>
      {/* A sibling, not a child: the annotator covers the whole window and owns the keyboard while open. */}
      <ScreenshotAnnotator
        isOpen={isOpen && isAnnotating}
        capture={captureScreen}
        onSave={addScreenshot}
        onCancel={() => setIsAnnotating(false)}
      />
    </>
  );
};

export default BugReportModal;
