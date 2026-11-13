import { describe, expect, it } from "vitest";
import {
  DEFAULT_KAGGLE_ADVANCED_FORM,
  advancedFormErrors,
  advancedLaunchFields,
  gitRefError,
  isAdvancedFormValid,
} from "../kaggleAdvancedLaunch";
import { DEFAULT_KAGGLE_LAUNCH_FORM, launchSettings } from "../KaggleLaunchOptions";

const form = (fields: Partial<typeof DEFAULT_KAGGLE_ADVANCED_FORM>) => ({ ...DEFAULT_KAGGLE_ADVANCED_FORM, ...fields });

describe("Kaggle advanced launch: git ref rules (training/notebooks/git_ref.py)", () => {
  it("accepts branch, tag and full SHA names", () => {
    for (const ref of ["main", "fix/review-remediation", "v16.9.210", "release_2026-11", "0f3c2a9b8e7d6c5b4a3928170f6e5d4c3b2a1908"]) {
      expect(gitRefError(ref)).toBeNull();
    }
  });

  it("refuses characters outside the allowed set and a leading option dash", () => {
    const message = "may only use letters, digits, '.', '_', '/' and '-' and must start with a letter or digit";
    for (const ref of ["-main", "--upload-pack=x", ".hidden", "feat branch", "a;b", "main~1", "ref^", "a:b"]) {
      expect(gitRefError(ref)).toBe(`Git ref '${ref}' ${message}`);
    }
  });

  it("refuses the forbidden git sequences and endings", () => {
    for (const ref of ["a..b", "a//b", "a/.b", "a/", "a.", "topic.lock"]) {
      expect(gitRefError(ref)).toBe(`Git ref '${ref}' is not a valid branch, tag or commit name`);
    }
  });

  it("refuses refs longer than 200 characters", () => {
    expect(gitRefError("a".repeat(200))).toBeNull();
    expect(gitRefError("a".repeat(201))).toBe("Git ref must have 1 to 200 characters");
  });
});

describe("Kaggle advanced launch: form validation", () => {
  it("is valid and sends nothing while every field is empty or blank", () => {
    expect(advancedFormErrors(DEFAULT_KAGGLE_ADVANCED_FORM)).toEqual({});
    expect(advancedLaunchFields(DEFAULT_KAGGLE_ADVANCED_FORM)).toEqual({});
    expect(advancedLaunchFields(form({ gitRef: "  ", limitHours: " " }))).toEqual({});
    expect(launchSettings(DEFAULT_KAGGLE_LAUNCH_FORM, null).advanced).toEqual({});
  });

  it("checks each ref field with the ref rules", () => {
    expect(advancedFormErrors(form({ gitRef: "a..b", envManagerRef: "-x" }))).toEqual({
      gitRef: "Git ref 'a..b' is not a valid branch, tag or commit name",
      envManagerRef: "Git ref '-x' may only use letters, digits, '.', '_', '/' and '-' and must start with a letter or digit",
    });
  });

  it("requires a session limit above 0 hours and a margin of 0 minutes or more", () => {
    expect(advancedFormErrors(form({ limitHours: "abc" })).limitHours).toBe("Session limit must be a number of hours");
    expect(advancedFormErrors(form({ limitHours: "0" })).limitHours).toBe("Session limit must be greater than 0 hours");
    expect(advancedFormErrors(form({ limitHours: "-2" })).limitHours).toBe("Session limit must be greater than 0 hours");
    expect(advancedFormErrors(form({ marginMinutes: "x" })).marginMinutes).toBe("Stop margin must be a number of minutes");
    expect(advancedFormErrors(form({ marginMinutes: "-1" })).marginMinutes).toBe("Stop margin must be 0 minutes or more");
    expect(advancedFormErrors(form({ marginMinutes: "0" }))).toEqual({});
  });

  it("requires the margin below the session limit when both are set", () => {
    expect(advancedFormErrors(form({ limitHours: "1", marginMinutes: "60" })).marginMinutes).toBe(
      "Stop margin must be below the session limit (60 minutes)"
    );
    expect(advancedFormErrors(form({ limitHours: "1", marginMinutes: "59.5" }))).toEqual({});
    expect(advancedFormErrors(form({ limitHours: "0", marginMinutes: "60" }))).toEqual({
      limitHours: "Session limit must be greater than 0 hours",
    });
  });

  it("sends the set fields trimmed and parsed, leaving the empty ones out", () => {
    const filled = form({ gitRef: " fix/review-remediation ", limitHours: "11.5" });
    expect(isAdvancedFormValid(filled)).toBe(true);
    expect(advancedLaunchFields(filled)).toEqual({ git_ref: "fix/review-remediation", limit_hours: 11.5 });
    expect(
      advancedLaunchFields(form({ gitRef: "main", envManagerRef: "v1.0.0", limitHours: "12", marginMinutes: "0" }))
    ).toEqual({ git_ref: "main", env_manager_ref: "v1.0.0", limit_hours: 12, margin_minutes: 0 });
  });

  it("never sends an invalid field", () => {
    const invalid = form({ gitRef: "bad..ref", limitHours: "6" });
    expect(isAdvancedFormValid(invalid)).toBe(false);
    expect(advancedLaunchFields(invalid)).toEqual({ limit_hours: 6 });
  });
});
