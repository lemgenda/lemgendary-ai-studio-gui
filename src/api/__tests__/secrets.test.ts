import { describe, it, expect, vi, afterEach } from "vitest";
import { saveSecrets, toSecretWriteItems } from "../client";
import { SecretDraft } from "../types";

const kept: SecretDraft = {
  id: "kaggle-alice",
  service: "kaggle",
  label: "Kaggle (alice)",
  username: "alice",
  is_default: true,
  has_value: true,
  value_hint: "5678",
};

describe("write-only secrets client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends an empty secret_value to keep the stored value and drops masking fields", () => {
    const [item] = toSecretWriteItems([kept]);
    expect(item.secret_value).toBe("");
    expect(item).not.toHaveProperty("has_value");
    expect(item).not.toHaveProperty("value_hint");
  });

  it("sends a trimmed new value to replace the stored value", () => {
    const [item] = toSecretWriteItems([{ ...kept, secret_value: "  KGAT_new_value  " }]);
    expect(item.secret_value).toBe("KGAT_new_value");
  });

  it("posts write-only items to /api/secrets", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "success", count: 1, message: "ok" }))
    );
    vi.stubGlobal("fetch", fetchMock);

    await saveSecrets([kept]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/secrets$/);
    const body = JSON.parse(String(init.body));
    expect(body.secrets[0]).toEqual({
      id: "kaggle-alice",
      service: "kaggle",
      label: "Kaggle (alice)",
      username: "alice",
      server: null,
      is_default: true,
      created_at: null,
      secret_value: "",
    });
  });
});
