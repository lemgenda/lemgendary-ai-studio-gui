import { describe, it, expect } from "vitest";
import {
  describePropagationIssues,
  describeSecretStatus,
  secretHasValue,
} from "../SecretsEditorTab";
import { SecretDraft } from "../../../api/types";

const base: SecretDraft = {
  id: "github-primary",
  service: "github",
  label: "GitHub",
  has_value: false,
  value_hint: "",
};

describe("SecretsEditorTab write-only helpers", () => {
  it("shows 'not set' when nothing is stored", () => {
    expect(describeSecretStatus(base)).toBe("not set");
    expect(secretHasValue(base)).toBe(false);
  });

  it("shows the masked hint for a stored value", () => {
    const stored = { ...base, has_value: true, value_hint: "1234" };
    expect(describeSecretStatus(stored)).toBe("set (••••1234)");
    expect(secretHasValue(stored)).toBe(true);
  });

  it("shows 'set' without a hint for short stored values", () => {
    expect(describeSecretStatus({ ...base, has_value: true })).toBe("set");
  });

  it("never displays a pending new value", () => {
    const pending = { ...base, secret_value: "ghp_typed_value" };
    expect(describeSecretStatus(pending)).toBe("new value (unsaved)");
    expect(describeSecretStatus(pending)).not.toContain("ghp_");
    expect(secretHasValue(pending)).toBe(true);
  });

  it("summarises skipped and failed propagation targets", () => {
    expect(describePropagationIssues({ status: "success", count: 1, message: "ok" })).toBeNull();
    const summary = describePropagationIssues({
      status: "success",
      count: 1,
      message: "ok",
      propagation: {
        written: [],
        skipped: [{ path: "~/.kaggle/kaggle.json", reason: "no username" }],
        failed: [{ path: "lemgendary-datasets/.kaggle_token", reason: "denied" }],
      },
    });
    expect(summary).toBe("lemgendary-datasets/.kaggle_token: denied; ~/.kaggle/kaggle.json: no username");
  });
});
