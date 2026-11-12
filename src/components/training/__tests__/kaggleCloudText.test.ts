import { describe, expect, it } from "vitest";
import { describeKaggleAuth } from "../kaggleAuthStatus";
import { summarizeKagglePush } from "../kagglePushSummary";
import { describeJobOutcome, transferJobLabel } from "../jobOutcome";
import { launchSettings, parseMaxResumes, parsePollInterval, DEFAULT_KAGGLE_LAUNCH_FORM } from "../KaggleLaunchOptions";
import { VARIATION_CHOICES, toVariationChoice } from "../kaggleVariations";
import { kaggleLogStatus } from "../../../api/kaggleLogLines";
import { isProgressLine, normalizeSocketMessage } from "../../../api/client";
import { KagglePushModelResponse, KaggleSuiteStatus } from "../../../api/types";

const STATUS: KaggleSuiteStatus = {
  authenticated: true,
  username: "alice",
  token_configured: true,
  auth_method: "access_token",
  http_status: 200,
  error: null,
};

describe("describeKaggleAuth", () => {
  it("shows the user and method when Kaggle accepted the token", () => {
    const view = describeKaggleAuth(STATUS);
    expect(view.badge).toBe("AUTHENTICATED");
    expect(view.detail).toBe("Authenticated as @alice with access token (KGAT_)");
    expect(view.problem).toBeNull();
  });

  it("gives an error text with HTTP status and reason when Kaggle refused it", () => {
    const view = describeKaggleAuth({ ...STATUS, authenticated: false, http_status: 401, error: "Unauthorized" });
    expect(view.badge).toBe("NOT AUTHENTICATED");
    expect(view.problem).toBe("Kaggle authentication failed as @alice (HTTP 401): Unauthorized. Check the Kaggle entry in the Secrets Vault.");
  });

  it("names a missing token and waits while unchecked", () => {
    const view = describeKaggleAuth({ ...STATUS, authenticated: false, username: "", token_configured: false, auth_method: null, http_status: null, error: null });
    expect(view.problem).toContain("No Kaggle token is configured");
    expect(describeKaggleAuth(null).badge).toBe("CHECKING");
  });
});

function pushResult(overrides: Partial<KagglePushModelResponse> = {}): KagglePushModelResponse {
  return {
    model_key: "upn_v2",
    success: true,
    variations: {
      "pytorch/default": { variation: "pytorch/default", handle: "a/upn-v2/pytorch/default", success: true, files: ["x"], dry_run: false, skipped: true },
      "onnx/fp16": { variation: "onnx/fp16", handle: "a/upn-v2/onnx/fp16", success: true, files: ["y", "z"], dry_run: false, skipped: false },
    },
    errors: [],
    ...overrides,
  };
}

describe("summarizeKagglePush", () => {
  it("shows skipped variations as unchanged, no new version", () => {
    const summary = summarizeKagglePush("upn_v2", pushResult(), false);
    expect(summary.type).toBe("success");
    expect(summary.message).toContain("Published 1 of 2 variation(s)");
    expect(summary.message).toContain("pytorch/default: unchanged, no new version");
  });

  it("reports an all-unchanged push as nothing new", () => {
    const res = pushResult();
    res.variations["onnx/fp16"].skipped = true;
    expect(summarizeKagglePush("upn_v2", res, false).type).toBe("info");
  });

  it("reads success false as an error, with the page sync failure text", () => {
    const summary = summarizeKagglePush(
      "upn_v2",
      pushResult({ success: false, variations: {}, errors: ["Model page metadata sync failed; nothing uploaded: 403"] }),
      false
    );
    expect(summary.type).toBe("error");
    expect(summary.message).toContain("Model page metadata sync failed; nothing uploaded");
  });
});

describe("describeJobOutcome", () => {
  const job = { id: "j1", job_type: "kaggle_train", model_key: "upn_v2" };

  it("shows a cancelled kernel with its reason", () => {
    const outcome = describeJobOutcome("Cloud training job", "j1", { ...job, status: "cancelled", error_message: "Kaggle kernel was cancelled (CANCEL_ACKNOWLEDGED)" });
    expect(outcome).toEqual({ kind: "notice", message: "Cloud training job j1 cancelled: Kaggle kernel was cancelled (CANCEL_ACKNOWLEDGED)" });
  });

  it("shows deadline_stop, resumes and the kernel of a completed session", () => {
    const outcome = describeJobOutcome("Cloud training job", "j1", {
      ...job,
      status: "completed",
      metrics: { kaggle_status: "COMPLETE", kernel_slug: "alice/upn-v2-training", deadline_stop: true, resumes: 2 },
    });
    expect(outcome.kind).toBe("notice");
    expect(outcome.message).toContain("Kernel: alice/upn-v2-training.");
    expect(outcome.message).toContain("Kaggle session deadline");
    expect(outcome.message).toContain("Resume sessions pushed: 2.");
  });

  it("lists unchanged variations of a push job and keeps failures as errors", () => {
    const pushed = describeJobOutcome("Job", "j2", { ...job, status: "completed", metrics: { variations: { "onnx/fp32": { skipped: true } } } });
    expect(pushed.message).toContain("onnx/fp32: unchanged, no new version.");
    expect(describeJobOutcome("Job", "j3", { ...job, status: "failed", error_message: "boom" })).toEqual({ kind: "error", message: "Job j3 failed: boom" });
  });
});

describe("Kaggle launch form", () => {
  it("clamps the poll interval to the backend minimum and defaults to 30", () => {
    expect(parsePollInterval("2")).toBe(5);
    expect(parsePollInterval("45")).toBe(45);
    expect(parsePollInterval("")).toBe(30);
    expect(parsePollInterval("abc")).toBe(30);
  });

  it("takes the listed default accelerator when none is picked", () => {
    const choices = { list: { default: "gpu-t4x2", accelerators: [] }, source: "sidecar" as const };
    expect(launchSettings(DEFAULT_KAGGLE_LAUNCH_FORM, choices)).toEqual({
      accelerator: "gpu-t4x2",
      autoPull: true,
      pollInterval: 30,
      autoResume: false,
      maxResumes: null,
    });
    expect(launchSettings({ ...DEFAULT_KAGGLE_LAUNCH_FORM, accelerator: "cpu" }, choices).accelerator).toBe("cpu");
  });

  it("parses the resume limit; empty keeps the config default and unchecked sends none", () => {
    expect(parseMaxResumes("")).toBeNull();
    expect(parseMaxResumes("abc")).toBeNull();
    expect(parseMaxResumes("-2")).toBe(0);
    expect(parseMaxResumes("4")).toBe(4);
    const choices = { list: { default: "cpu", accelerators: [] }, source: "snapshot" as const };
    const unchecked = { ...DEFAULT_KAGGLE_LAUNCH_FORM, maxResumesText: "4" };
    expect(launchSettings(unchecked, choices).maxResumes).toBeNull();
    expect(launchSettings({ ...unchecked, autoResume: true }, choices).maxResumes).toBe(4);
  });

  it("names card transfer jobs in the outcome banner", () => {
    expect(transferJobLabel("kaggle_push")).toBe("Kaggle push job");
    expect(transferJobLabel("kaggle_pull")).toBe("Kaggle pull job");
    expect(transferJobLabel("toString")).toBe("Kaggle transfer job");
    const pulled = describeJobOutcome("Kaggle pull job", "j4", { id: "j4", job_type: "kaggle_pull", model_key: "m", status: "completed", metrics: { variations_pulled: 4 } });
    expect(pulled.message).toBe("Kaggle pull job j4 completed. Variations pulled: 4.");
  });
});

describe("variation choices", () => {
  it("offers all plus the four backend keys and nothing else", () => {
    expect(VARIATION_CHOICES.map((c) => c.value)).toEqual(["all", "pytorch/default", "pytorch/fp32", "onnx/fp16", "onnx/fp32"]);
    expect(toVariationChoice("onnx_fp16")).toBe("all");
    expect(toVariationChoice("onnx/fp16")).toBe("onnx/fp16");
  });
});

describe("Kaggle push log lines", () => {
  const unchanged = "[UPLOAD] [Step 2/4] UNCHANGED (no new version) upn_v2 [pytorch/fp32] (50%)";
  const pageFailed = "[ERROR] Kaggle publish failed for upn_v2: Model page metadata sync failed; nothing uploaded: 403";

  it("classifies unchanged variations as warnings and a failed page sync as an error", () => {
    expect(kaggleLogStatus(unchanged)).toBe("warning");
    expect(kaggleLogStatus(pageFailed)).toBe("error");
    expect(kaggleLogStatus("[UPLOAD] [Step 1/4] DONE files=3 upn_v2 [pytorch/default] (25%)")).toBeNull();
  });

  it("keeps them as their own console lines with that status", () => {
    expect(isProgressLine(unchanged)).toBe(false);
    const ev = normalizeSocketMessage({ job_id: "j", job_type: "kaggle_push", message: unchanged }, "Cloud Training");
    expect(ev?.status).toBe("warning");
    expect(ev?.is_progress).toBe(false);
  });
});
