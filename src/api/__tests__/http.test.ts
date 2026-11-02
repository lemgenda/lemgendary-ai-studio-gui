import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT_HEADER, CLIENT_HEADER_VALUE, sidecarFetch } from "../http";

describe("sidecarFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds the client header to a request without headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await sidecarFetch("http://127.0.0.1:8000/api/health");

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get(CLIENT_HEADER)).toBe(CLIENT_HEADER_VALUE);
  });

  it("keeps existing headers and request options", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await sidecarFetch("http://127.0.0.1:8000/api/clean", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("http://127.0.0.1:8000/api/clean");
    expect(init.method).toBe("POST");
    expect(init.body).toBe("{}");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get(CLIENT_HEADER)).toBe(CLIENT_HEADER_VALUE);
  });
});
