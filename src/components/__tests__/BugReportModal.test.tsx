// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "../Header";
import { BugReportModal } from "../bugReport/BugReportModal";
import { useStudioStore } from "../../store/useStudioStore";
import { BugReportResponse } from "../../api/types";
import { BugReportSubmitError, ENV_MANAGER_OFFLINE_MESSAGE } from "../../bugReport/serverErrors";
import { BUG_REPORT_LIMITS } from "../../bugReport/limits";
import { NativeRecordingStatus, RecorderBackend } from "../../bugReport/recording";
import { packRecording } from "../../bugReport/__tests__/packRecording";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const VALID_DESCRIPTION = "The training panel froze after I pressed Start; the log stopped updating.";

const SAVED: BugReportResponse = {
  report_id: "r1",
  archive_name: "bug_report_20261103.zip",
  archive_path: "bug-reports/bug_report_20261103.zip",
  recipient: "support@example.com",
  subject: "LemGendary bug report r1",
  mail_client_opened: false,
  folder_revealed: false,
};

type Submit = (form: FormData) => Promise<BugReportResponse>;

/** Mirrors the App wiring: the open modal lives in one store field, the header opens it. */
interface ShellProps {
  submit: Submit;
  capture: () => Promise<HTMLCanvasElement>;
  recorderBackend?: RecorderBackend;
}

const Shell: React.FC<ShellProps> = ({ submit, capture, recorderBackend }) => {
  const activeModal = useStudioStore((s) => s.activeModal);
  const openModal = useStudioStore((s) => s.openModal);
  const closeModal = useStudioStore((s) => s.closeModal);
  return (
    <>
      <Header
        title="Dashboard"
        onRefresh={() => undefined}
        isRefreshing={false}
        onOpenBugReport={() => openModal("bug-report")}
        envManagerOnline={false}
      />
      <BugReportModal
        isOpen={activeModal === "bug-report"}
        onClose={closeModal}
        submit={submit}
        captureScreen={capture}
        recorderBackend={recorderBackend}
        recordingAvailable={recorderBackend !== undefined}
      />
    </>
  );
};

function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

/** jsdom's Blob has no `text()`; FileReader reads it. */
function readText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("Report Issue modal", () => {
  let container: HTMLDivElement;
  let root: Root;
  let submit: ReturnType<typeof vi.fn<Submit>>;
  let capture: ReturnType<typeof vi.fn<() => Promise<HTMLCanvasElement>>>;

  const query = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);
  const click = async (selector: string) => {
    const element = query<HTMLElement>(selector);
    expect(element, selector).not.toBeNull();
    await act(async () => {
      element?.click();
    });
    await flush();
  };
  const fillValidForm = () => {
    act(() => {
      setValue(query<HTMLInputElement>("#bug-modal-email") as HTMLInputElement, "user@example.com");
      setValue(query<HTMLTextAreaElement>("#bug-modal-description") as HTMLTextAreaElement, VALID_DESCRIPTION);
    });
  };

  beforeEach(async () => {
    // The header asks nothing of the network while the Environment Manager is offline.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("unexpected fetch")));
    useStudioStore.setState({ activeModal: null, currentTab: "training", events: [] });
    submit = vi.fn<Submit>().mockResolvedValue(SAVED);
    capture = vi.fn<() => Promise<HTMLCanvasElement>>().mockImplementation(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 40;
      canvas.height = 30;
      return canvas;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => ({ drawImage: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn() }) as unknown as CanvasRenderingContext2D
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (callback, type) {
      callback(new Blob(["image"], { type: type ?? "image/png" }));
    });
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:thumb"), revokeObjectURL: vi.fn() }));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<Shell submit={submit} capture={capture} />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens from the header button with the module preselected from the current tab", async () => {
    expect(query("#bug-modal-dialog")).toBeNull();
    await click("#header-btn-report-issue");
    const dialog = query("#bug-modal-dialog");
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(query(`#${dialog?.getAttribute("aria-labelledby")}`)?.textContent).toBe("Report Issue");
    expect(query<HTMLSelectElement>("#bug-modal-module")?.value).toBe("training");
    expect(query<HTMLInputElement>("#bug-modal-telemetry")?.checked).toBe(true);
    expect(query("#bug-modal-recording-slot")?.textContent).toContain("available in the desktop app");
  });

  it("closes on Escape and returns focus to the header button", async () => {
    const button = query<HTMLButtonElement>("#header-btn-report-issue");
    button?.focus();
    await click("#header-btn-report-issue");
    expect(document.activeElement?.id).toBe("bug-modal-email");
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(query("#bug-modal-dialog")).toBeNull();
    expect(useStudioStore.getState().activeModal).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("validates on the client and does not send an invalid report", async () => {
    await click("#header-btn-report-issue");
    act(() => {
      setValue(query<HTMLTextAreaElement>("#bug-modal-description") as HTMLTextAreaElement, "Too short");
    });
    expect(query("#bug-modal-description-counter")?.textContent).toContain(`9 / ${BUG_REPORT_LIMITS.descriptionMaxLength}`);
    await click("#bug-modal-btn-submit");
    expect(submit).not.toHaveBeenCalled();
    expect(query("#bug-modal-email-error")?.textContent).toMatch(/required/);
    expect(query("#bug-modal-description-error")?.textContent).toMatch(/at least 50/);
  });

  it("sends the form with telemetry and shows the server's field errors on 422", async () => {
    useStudioStore.setState({
      events: [{ timestamp: "t", step_number: 0, total_steps: 0, step_name: "S", status: "info", message: "hello, world" }],
    });
    submit.mockRejectedValueOnce(
      new BugReportSubmitError("validation", "The Environment Manager rejected some fields.", { email: "Enter a valid email address." })
    );
    await click("#header-btn-report-issue");
    fillValidForm();
    await click("#bug-modal-btn-submit");
    expect(submit).toHaveBeenCalledTimes(1);
    const form = submit.mock.calls[0][0];
    expect(form.get("module")).toBe("LemGendary Model Training Suite");
    expect(form.get("current_tab")).toBe("training");
    expect(String(form.get("app_version"))).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(await readText(form.get("telemetry") as File)).toContain('"hello, world"');
    expect(query("#bug-modal-email-error")?.textContent).toBe("Enter a valid email address.");
  });

  it("shows a clear error when the Environment Manager is offline", async () => {
    submit.mockRejectedValueOnce(new BugReportSubmitError("offline", ENV_MANAGER_OFFLINE_MESSAGE));
    await click("#header-btn-report-issue");
    fillValidForm();
    await click("#bug-modal-btn-submit");
    expect(query("#bug-modal-error")?.textContent).toMatch(/^Environment Manager is not running/);
  });

  it("shows the saved archive with copy buttons, then resets on close", async () => {
    await click("#header-btn-report-issue");
    fillValidForm();
    await click("#bug-modal-telemetry");
    await click("#bug-modal-btn-submit");
    expect(submit.mock.calls[0][0].has("telemetry")).toBe(false);
    expect(query("#bug-modal-archive-path")?.textContent).toBe(SAVED.archive_path);
    expect(query("#bug-modal-recipient")?.textContent).toBe(SAVED.recipient);
    expect(query("#bug-modal-subject")?.textContent).toBe(SAVED.subject);
    expect(query("#bug-modal-btn-copy-address")).not.toBeNull();
    expect(query("#bug-modal-btn-copy-subject")).not.toBeNull();
    expect(query("#bug-modal-note-mail")).not.toBeNull();
    expect(query("#bug-modal-note-folder")).not.toBeNull();
    await click("#bug-modal-btn-done");
    await click("#header-btn-report-issue");
    expect(query<HTMLInputElement>("#bug-modal-email")?.value).toBe("");
    expect(query<HTMLInputElement>("#bug-modal-telemetry")?.checked).toBe(true);
  });

  it("captures annotated screenshots, at most five", async () => {
    await click("#header-btn-report-issue");
    for (let i = 0; i < BUG_REPORT_LIMITS.maxScreenshots; i += 1) {
      await click("#bug-modal-btn-add-screenshot");
      expect(query("#annotator-dialog")?.closest("[data-capture-exclude]")).not.toBeNull();
      await click("#annotator-btn-save");
      expect(query("#annotator-dialog")).toBeNull();
    }
    expect(capture).toHaveBeenCalledTimes(BUG_REPORT_LIMITS.maxScreenshots);
    expect(document.querySelectorAll(".bug-screenshot-thumb")).toHaveLength(BUG_REPORT_LIMITS.maxScreenshots);
    expect(query<HTMLButtonElement>("#bug-modal-btn-add-screenshot")?.disabled).toBe(true);

    await click("#bug-modal-btn-remove-screenshot-2");
    expect(document.querySelectorAll(".bug-screenshot-thumb")).toHaveLength(BUG_REPORT_LIMITS.maxScreenshots - 1);
    expect(query<HTMLButtonElement>("#bug-modal-btn-add-screenshot")?.disabled).toBe(false);

    fillValidForm();
    await click("#bug-modal-btn-submit");
    const shots = submit.mock.calls[0][0].getAll("screenshot") as File[];
    expect(shots).toHaveLength(BUG_REPORT_LIMITS.maxScreenshots - 1);
    expect(shots.every((shot) => shot.type === "image/webp")).toBe(true);
  });

  it("closes only the annotator on Escape", async () => {
    await click("#header-btn-report-issue");
    await click("#bug-modal-btn-add-screenshot");
    expect(query("#annotator-dialog")).not.toBeNull();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(query("#annotator-dialog")).toBeNull();
    expect(query("#bug-modal-dialog")).not.toBeNull();
  });

  it("hides the dialog while recording the app window and attaches the MP4 on stop", async () => {
    const status = (state: NativeRecordingStatus["state"], elapsedMs: number): NativeRecordingStatus => ({
      state,
      elapsedMs,
      maxMs: 60_000,
      frames: 10,
      error: null,
    });
    const video = new Uint8Array([0, 0, 0, 8, 102, 116, 121, 112]);
    const backend: RecorderBackend = {
      start: vi.fn().mockResolvedValue(status("recording", 0)),
      pause: vi.fn().mockResolvedValue(status("paused", 1200)),
      resume: vi.fn().mockResolvedValue(status("recording", 1200)),
      status: vi.fn().mockResolvedValue(status("recording", 1300)),
      stop: vi.fn().mockResolvedValue(
        packRecording({ mime: "video/mp4", durationMs: 2500, frames: 60, fps: 24, width: 730, height: 480 }, video)
      ),
    };
    await act(async () => {
      root.render(<Shell submit={submit} capture={capture} recorderBackend={backend} />);
    });
    await click("#header-btn-report-issue");
    await click("#bug-modal-btn-start-recording");
    expect(query("#bug-modal-dialog")).toBeNull();
    expect(query("#recording-control-status")?.textContent).toBe("Recording");

    await click("#recording-btn-pause");
    expect(query("#recording-control-status")?.textContent).toBe("Paused");
    expect(query("#recording-control-time")?.textContent).toBe("0:01 / 1:00");
    await click("#recording-btn-resume");
    await click("#recording-btn-stop");

    expect(query("#recording-control-bar")).toBeNull();
    expect(query("#bug-modal-dialog")).not.toBeNull();
    expect(query("#bug-modal-recording-summary")?.textContent).toContain("0:02, 730x480");

    fillValidForm();
    await click("#bug-modal-btn-submit");
    const recording = submit.mock.calls[0][0].get("recording") as File;
    expect(recording.name).toBe("recording.mp4");
    expect(recording.type).toBe("video/mp4");
    expect(recording.size).toBe(video.length);
  });

  it("shows a recorder failure in the dialog", async () => {
    const backend: RecorderBackend = {
      start: vi.fn().mockRejectedValue("Could not start window capture: access denied"),
      pause: vi.fn(),
      resume: vi.fn(),
      status: vi.fn(),
      stop: vi.fn(),
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await act(async () => {
      root.render(<Shell submit={submit} capture={capture} recorderBackend={backend} />);
    });
    await click("#header-btn-report-issue");
    await click("#bug-modal-btn-start-recording");
    expect(query("#bug-modal-dialog")).not.toBeNull();
    expect(query("#bug-modal-recorder-error")?.textContent).toContain("access denied");
  });
});
