// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { BugReportDraft, validateBugReportDraft } from "../draft";
import { buildTelemetryCsv, escapeCsvField } from "../telemetryCsv";
import { buildBugReportFormData } from "../formData";
import { BUG_REPORT_FILE_FIELDS, BUG_REPORT_TEXT_FIELDS } from "../fields";
import { BUG_REPORT_LIMITS } from "../limits";
import { BugReportSubmitError, ENV_MANAGER_OFFLINE_MESSAGE, mapServerDetail } from "../serverErrors";
import { canvasToImageBlob } from "../screenshotCapture";
import { ENV_BASE, submitBugReport } from "../../api/client";
import { PipelineEvent } from "../../api/types";
import openapi from "../../../../lemgendary-env-manager/openapi.json";

const VALID_DESCRIPTION = "The training panel froze after I pressed Start; the log stopped updating.";

function draft(overrides: Partial<BugReportDraft> = {}): BugReportDraft {
  return {
    email: "user@example.com",
    module: "Dashboard",
    appVersion: "v2.10.19",
    currentTab: "dashboard",
    description: VALID_DESCRIPTION,
    screenshots: [],
    telemetryCsv: null,
    recording: null,
    ...overrides,
  };
}

function event(message: string, overrides: Partial<PipelineEvent> = {}): PipelineEvent {
  return {
    timestamp: "2026-11-03T10:00:00Z",
    step_number: 0,
    total_steps: 0,
    step_name: "Studio Console",
    status: "info",
    message,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bug report validation", () => {
  it("accepts a complete draft", () => {
    expect(validateBugReportDraft(draft())).toEqual({});
  });

  it("requires a valid email within 254 characters", () => {
    expect(validateBugReportDraft(draft({ email: "  " })).email).toMatch(/required/);
    expect(validateBugReportDraft(draft({ email: "user@localhost" })).email).toMatch(/valid email/);
    const long = `${"a".repeat(250)}@example.com`;
    expect(validateBugReportDraft(draft({ email: long })).email).toMatch(/254/);
  });

  it("requires 50 to 10000 description characters after trimming", () => {
    const short = `   ${"x".repeat(49)}   `;
    expect(validateBugReportDraft(draft({ description: short })).description).toMatch(/at least 50 .*\(49 given\)/);
    expect(validateBugReportDraft(draft({ description: "x".repeat(50) })).description).toBeUndefined();
    expect(validateBugReportDraft(draft({ description: "x".repeat(10_001) })).description).toMatch(/10000/);
  });

  it("checks module, version and tab lengths", () => {
    const errors = validateBugReportDraft(draft({ module: " ", appVersion: "v".repeat(101), currentTab: "" }));
    expect(errors.module).toMatch(/required/);
    expect(errors.app_version).toMatch(/100/);
    expect(errors.current_tab).toMatch(/required/);
  });

  it("limits screenshots by count, type and size", () => {
    const png = new Blob(["x"], { type: "image/png" });
    expect(validateBugReportDraft(draft({ screenshots: Array(6).fill(png) })).screenshot).toMatch(/At most 5/);
    expect(validateBugReportDraft(draft({ screenshots: [new Blob(["x"], { type: "image/jpeg" })] })).screenshot).toMatch(
      /image\/png or image\/webp/
    );
    const big = new Blob([new Uint8Array(BUG_REPORT_LIMITS.screenshotMaxBytes + 1)], { type: "image/webp" });
    expect(validateBugReportDraft(draft({ screenshots: [big] })).screenshot).toMatch(/5 MB/);
  });

  it("limits telemetry to 2 MB of UTF-8", () => {
    const csv = "x".repeat(BUG_REPORT_LIMITS.telemetryMaxBytes + 1);
    expect(validateBugReportDraft(draft({ telemetryCsv: csv })).telemetry).toMatch(/2 MB/);
  });

  it("checks the recording type and the 80 MB total", () => {
    expect(validateBugReportDraft(draft({ recording: new Blob(["x"], { type: "video/avi" }) })).recording).toMatch(
      /webm or video\/mp4/
    );
    const atLimit = new Blob([new Uint8Array(BUG_REPORT_LIMITS.recordingMaxBytes)], { type: "video/webm" });
    expect(validateBugReportDraft(draft({ recording: atLimit }))).toEqual({});
    const shot = new Blob([new Uint8Array(BUG_REPORT_LIMITS.screenshotMaxBytes)], { type: "image/png" });
    const tooBig = new Blob([new Uint8Array(BUG_REPORT_LIMITS.recordingMaxBytes + 4 * 1024 * 1024)], { type: "video/webm" });
    const errors = validateBugReportDraft(
      draft({ recording: tooBig, screenshots: Array(5).fill(shot), telemetryCsv: "x".repeat(BUG_REPORT_LIMITS.telemetryMaxBytes) })
    );
    expect(errors.recording).toMatch(/50 MB/);
    expect(errors.form).toMatch(/80 MB in total/);
  });
});

describe("telemetry CSV", () => {
  it("writes the header row and one row per event with CRLF line ends", () => {
    const csv = buildTelemetryCsv([event("Started", { origin: "env-manager" }), event("Done", { status: "success" })]);
    expect(csv).toBe(
      "timestamp,status,source,message\r\n" +
        "2026-11-03T10:00:00Z,info,env-manager,Started\r\n" +
        "2026-11-03T10:00:00Z,success,Studio Console,Done\r\n"
    );
  });

  it("quotes fields with commas, quotes and line breaks (RFC 4180)", () => {
    expect(escapeCsvField("plain")).toBe("plain");
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvField("cr\rhere")).toBe('"cr\rhere"');
    const csv = buildTelemetryCsv([event('Error: "x", then\r\nretry', { step_name: "Step, 2" })]);
    expect(csv).toBe(
      'timestamp,status,source,message\r\n2026-11-03T10:00:00Z,info,"Step, 2","Error: ""x"", then\r\nretry"\r\n'
    );
  });

  it("is only the header for no events", () => {
    expect(buildTelemetryCsv([])).toBe("timestamp,status,source,message\r\n");
  });
});

describe("bug report form data", () => {
  it("uses the server's multipart field names", () => {
    const schemas = openapi.components.schemas;
    const serverText = Object.keys(schemas.BugReportFields.properties).sort();
    const serverFiles = Object.keys(schemas.Body_submit_bug_report_api_bug_report_post.properties).sort();
    expect([...BUG_REPORT_TEXT_FIELDS].sort()).toEqual(serverText);
    expect([...BUG_REPORT_FILE_FIELDS].sort()).toEqual(serverFiles);
  });

  it("sends trimmed text fields and every attachment under its field", () => {
    const shot = new Blob(["png"], { type: "image/png" });
    const webp = new Blob(["webp"], { type: "image/webp" });
    const recording = new Blob(["rec"], { type: "video/webm" });
    const form = buildBugReportFormData(
      draft({ email: " user@example.com ", screenshots: [shot, webp], telemetryCsv: "timestamp\r\n", recording })
    );
    expect(form.get("email")).toBe("user@example.com");
    expect(form.get("module")).toBe("Dashboard");
    expect(form.get("app_version")).toBe("v2.10.19");
    expect(form.get("current_tab")).toBe("dashboard");
    expect(form.get("description")).toBe(VALID_DESCRIPTION);
    const screenshots = form.getAll("screenshot") as File[];
    expect(screenshots.map((file) => file.name)).toEqual(["screenshot_1.png", "screenshot_2.webp"]);
    const telemetry = form.get("telemetry") as File;
    expect(telemetry.name).toBe("telemetry.csv");
    expect(telemetry.type).toBe("text/csv");
    expect((form.get("recording") as File).name).toBe("recording.webm");
  });

  it("leaves out telemetry and recording when there are none", () => {
    const form = buildBugReportFormData(draft());
    expect(form.has("telemetry")).toBe(false);
    expect(form.has("recording")).toBe(false);
    expect(form.has("screenshot")).toBe(false);
  });
});

describe("bug report server errors", () => {
  it("maps 422 detail entries to fields", () => {
    const errors = mapServerDetail([
      { loc: ["body", "email"], msg: "Enter a valid email address.", type: "value_error" },
      { loc: ["body", "description"], msg: "Too short.", type: "value_error" },
      { loc: ["body", "screenshot"], msg: "Unsupported type.", type: "value_error" },
      { loc: ["body"], msg: "Something else.", type: "value_error" },
    ]);
    expect(errors).toEqual({
      email: "Enter a valid email address.",
      description: "Too short.",
      screenshot: "Unsupported type.",
      form: "Something else.",
    });
  });

  it("submitBugReport posts to the Environment Manager and maps a 422", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: [{ loc: ["body", "module"], msg: "Field required", type: "missing" }] }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const form = buildBugReportFormData(draft());
    const error = await submitBugReport(form).catch((err: unknown) => err);
    expect(fetchMock).toHaveBeenCalledWith(`${ENV_BASE}/api/bug-report`, expect.objectContaining({ method: "POST", body: form }));
    expect(error).toBeInstanceOf(BugReportSubmitError);
    expect((error as BugReportSubmitError).kind).toBe("validation");
    expect((error as BugReportSubmitError).fieldErrors).toEqual({ module: "Field required" });
    vi.unstubAllGlobals();
  });

  it("explains a 413 with the size limits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: [{ loc: ["body", "recording"], msg: "File exceeds the 50 MB limit." }] }), {
          status: 413,
        })
      )
    );
    const error = (await submitBugReport(new FormData()).catch((err: unknown) => err)) as BugReportSubmitError;
    expect(error.kind).toBe("too_large");
    expect(error.message).toMatch(/too large.*80 MB/);
    expect(error.fieldErrors.recording).toBe("File exceeds the 50 MB limit.");
    vi.unstubAllGlobals();
  });

  it("reports an unreachable Environment Manager as offline", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = (await submitBugReport(new FormData()).catch((err: unknown) => err)) as BugReportSubmitError;
    expect(error.kind).toBe("offline");
    expect(error.message).toBe(ENV_MANAGER_OFFLINE_MESSAGE);
    expect(error.message).toMatch(/^Environment Manager is not running/);
    vi.unstubAllGlobals();
  });

  it("returns the saved report on 200", async () => {
    const body = {
      report_id: "r1",
      archive_name: "bug_report_1.zip",
      archive_path: "bug-reports/bug_report_1.zip",
      recipient: "support@example.com",
      subject: "Bug report r1",
      mail_client_opened: true,
      folder_revealed: false,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));
    await expect(submitBugReport(new FormData())).resolves.toEqual(body);
    vi.unstubAllGlobals();
  });
});

describe("screenshot encoding", () => {
  it("uses WebP when the WebView encodes it", async () => {
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "toBlob").mockImplementation((callback, type) => callback(new Blob(["x"], { type: type ?? "" })));
    expect((await canvasToImageBlob(canvas)).type).toBe("image/webp");
  });

  it("falls back to PNG when WebP encoding returns null (WebKit)", async () => {
    const canvas = document.createElement("canvas");
    const toBlob = vi
      .spyOn(canvas, "toBlob")
      .mockImplementation((callback, type) => callback(type === "image/webp" ? null : new Blob(["x"], { type: "image/png" })));
    expect((await canvasToImageBlob(canvas)).type).toBe("image/png");
    expect(toBlob).toHaveBeenCalledTimes(2);
  });
});
