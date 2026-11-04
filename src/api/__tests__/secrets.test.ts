import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchKaggleSuiteStatus, saveSecrets, toSecretWriteItems } from "../client";
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

  it("derives Kaggle token status from has_value, never from a raw value", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/api/secrets")) {
        return Promise.resolve(new Response(JSON.stringify({ status: "success", secrets: [kept] })));
      }
      return Promise.resolve(new Response("{}", { status: 503 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const status = await fetchKaggleSuiteStatus();

    expect(status.username).toBe("alice");
    expect(status.token_configured).toBe(true);
    expect(status.authenticated).toBe(true);
  });
});
