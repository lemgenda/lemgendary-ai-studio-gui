// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { MESH_SERVICES, probeSidecarPort, triggerSafeUpdate } from "../client";

describe("sidecar liveness probe", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("probes the env manager on the cheap /api/ping endpoint, not the health audit", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ status: "ok" })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(probeSidecarPort("env-manager")).resolves.toBe(true);
    await expect(probeSidecarPort(8000)).resolves.toBe(true);

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual([
      `${MESH_SERVICES["env-manager"].httpUrl}/api/ping`,
      `${MESH_SERVICES["env-manager"].httpUrl}/api/ping`,
    ]);
  });

  it("uses each service's configured liveness path", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await probeSidecarPort("dataset-compiler");

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${MESH_SERVICES["dataset-compiler"].httpUrl}${MESH_SERVICES["dataset-compiler"].livenessPath}`
    );
  });

  it("reports offline on a network error", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(probeSidecarPort("env-manager")).resolves.toBe(false);
  });
});

describe("triggerSafeUpdate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the project and returns the background job id", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ status: "accepted", job_id: "abc", events: [] }))
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await triggerSafeUpdate(false, "lemgendary-datasets");

    expect(res.job_id).toBe("abc");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ dry_run: false, project: "lemgendary-datasets" });
  });

  it("surfaces the 409 detail when an update is already running", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(
        async () =>
          new Response(JSON.stringify({ detail: "An update is already running (job abc)." }), { status: 409 })
      )
    );

    await expect(triggerSafeUpdate()).rejects.toThrow("(409): An update is already running (job abc).");
  });
});
