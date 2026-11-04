// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => false),
}));
vi.mock("@tauri-apps/plugin-shell", () => ({
  open: vi.fn(),
}));

import { invoke, isTauri } from "@tauri-apps/api/core";
import { open as openWithShell } from "@tauri-apps/plugin-shell";
import {
  ENV_BASE,
  TRAINING_BASE,
  fetchDocsStatus,
  fetchModels,
  openExternalUrl,
  startAllServices,
  startService,
  stopService,
} from "../client";
import { MESH_SERVICES } from "../config";

const invokeMock = vi.mocked(invoke);
const isTauriMock = vi.mocked(isTauri);
const shellOpenMock = vi.mocked(openWithShell);

const PING_URL = `${ENV_BASE}/api/ping`;

/** fetch mock: env-manager ping answers per `envOnline`; other URLs answer from `routes`. */
function stubFetch(envOnline: boolean, routes: Record<string, () => Response> = {}) {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url === PING_URL) {
      if (!envOnline) throw new TypeError("Failed to fetch");
      return new Response(JSON.stringify({ status: "ok" }));
    }
    const route = routes[url];
    if (!route) throw new Error(`unexpected request ${url}`);
    return route();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestedUrls(fetchMock: ReturnType<typeof stubFetch>): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url));
}

describe("service control routing", () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(false);
    invokeMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("starts a service through the Environment Manager when it is online", async () => {
    const startUrl = `${ENV_BASE}/api/services/training-suite/start`;
    const fetchMock = stubFetch(true, {
      [startUrl]: () => new Response(JSON.stringify({ status: "started", message: "ok", port: MESH_SERVICES["training-suite"].defaultPort })),
    });

    const res = await startService("training-suite");

    expect(res.status).toBe("started");
    expect(requestedUrls(fetchMock)).toEqual([PING_URL, startUrl]);
    expect(requestedUrls(fetchMock).some((u) => u.startsWith("/api/dev"))).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("surfaces the Environment Manager's HTTP error instead of falling back", async () => {
    const startUrl = `${ENV_BASE}/api/services/training-suite/start`;
    stubFetch(true, {
      [startUrl]: () => new Response(JSON.stringify({ detail: "venv missing" }), { status: 400 }),
    });

    await expect(startService("training-suite")).rejects.toThrow("venv missing");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("falls back to the Tauri spawn_service command when the Environment Manager is offline", async () => {
    isTauriMock.mockReturnValue(true);
    const fetchMock = stubFetch(false);

    const res = await startService("env-manager");

    expect(invokeMock).toHaveBeenCalledWith("spawn_service", { serviceId: "env-manager" });
    expect(res.status).toBe("started");
    expect(requestedUrls(fetchMock)).toEqual([PING_URL]);
  });

  it("falls back to the Tauri spawn_all_services command when the Environment Manager is offline", async () => {
    isTauriMock.mockReturnValue(true);
    stubFetch(false);

    await startAllServices();

    expect(invokeMock).toHaveBeenCalledWith("spawn_all_services", undefined);
  });

  it("explains that a plain browser session cannot start services when the Environment Manager is offline", async () => {
    stubFetch(false);

    await expect(startService("dataset-compiler")).rejects.toThrow(/plain browser session/);
    await expect(startAllServices()).rejects.toThrow(/plain browser session/);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("starts all services through the Environment Manager start-all endpoint", async () => {
    const url = `${ENV_BASE}/api/services/start-all`;
    const fetchMock = stubFetch(true, { [url]: () => new Response(JSON.stringify({ results: {} })) });

    await startAllServices();

    expect(requestedUrls(fetchMock)).toEqual([PING_URL, url]);
  });

  it("stops a service through the Environment Manager and surfaces errors", async () => {
    const url = `${ENV_BASE}/api/services/dataset-compiler/stop`;
    stubFetch(true, { [url]: () => new Response(JSON.stringify({ detail: "not running" }), { status: 400 }) });

    await expect(stopService("dataset-compiler")).rejects.toThrow("not running");
  });

  it("explains an offline Environment Manager when a browser session stops a service", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    }));

    await expect(stopService("training-suite")).rejects.toThrow(/Environment Manager \(port \d+\) is offline/);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("stops a service with the native stop_service command in the desktop app", async () => {
    isTauriMock.mockReturnValue(true);
    const native = { status: "stopped", message: "Service 'env-manager' stopped (pid 42).", port: MESH_SERVICES["env-manager"].defaultPort };
    invokeMock.mockResolvedValue(native);
    const fetchMock = stubFetch(false);

    await expect(stopService("env-manager")).resolves.toEqual(native);
    expect(invokeMock).toHaveBeenCalledWith("stop_service", { serviceId: "env-manager" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the Environment Manager when the native stop fails, and reports both failures", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockRejectedValue("netstat failed");
    const url = `${ENV_BASE}/api/services/dataset-compiler/stop`;
    stubFetch(true, { [url]: () => new Response(JSON.stringify({ status: "stopped", message: "ok" })) });

    await expect(stopService("dataset-compiler")).resolves.toMatchObject({ status: "stopped" });

    stubFetch(true, { [url]: () => new Response(JSON.stringify({ detail: "not running" }), { status: 400 }) });
    await expect(stopService("dataset-compiler")).rejects.toThrow(/Native stop failed \(netstat failed\);.*not running/);
  });
});

describe("model telemetry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads telemetry for N models with a single with-stats request", async () => {
    const url = `${TRAINING_BASE}/api/gui/models/with-stats`;
    const raw = ["upn_v2", "codeformer", "yolov8n"].map((key, i) => ({
      key,
      model_key: key,
      active_res: 256 + i * 128,
      data_fraction_completed: 0.4,
      epochs_completed: 3 + i,
    }));
    const fetchMock = stubFetch(true, { [url]: () => new Response(JSON.stringify(raw)) });

    const models = await fetchModels();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedUrls(fetchMock)).toEqual([url]);
    expect(models.map((m) => [m.key, m.active_res, m.epochs_completed, m.data_fraction_completed])).toEqual([
      ["upn_v2", 256, 3, 0.4],
      ["codeformer", 384, 4, 0.4],
      ["yolov8n", 512, 5, 0.4],
    ]);
  });
});

describe("documentation hub", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("reads the hub location from the Environment Manager", async () => {
    const url = `${ENV_BASE}/api/docs/status`;
    const status = { offline_available: true, local_url: `${ENV_BASE}/documentation-hub/index.html`, online_url: "https://example.org" };
    stubFetch(true, { [url]: () => new Response(JSON.stringify(status)) });

    await expect(fetchDocsStatus()).resolves.toEqual(status);
  });

  it("throws instead of inventing a hub URL when the Environment Manager is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => Promise.reject(new TypeError("Failed to fetch"))));

    await expect(fetchDocsStatus()).rejects.toThrow("Failed to fetch");
  });

  it("opens the hub with the Tauri shell in the desktop app and window.open in a browser", async () => {
    isTauriMock.mockReturnValue(true);
    await openExternalUrl(`${ENV_BASE}/documentation-hub/index.html`);
    expect(shellOpenMock).toHaveBeenCalledWith(`${ENV_BASE}/documentation-hub/index.html`);

    isTauriMock.mockReturnValue(false);
    const fakeWindow = { opener: {} } as unknown as Window;
    const openSpy = vi.spyOn(window, "open").mockReturnValue(fakeWindow);
    await openExternalUrl(`${ENV_BASE}/documentation-hub/index.html`);
    expect(openSpy).toHaveBeenCalledWith(`${ENV_BASE}/documentation-hub/index.html`, "_blank");
    expect(fakeWindow.opener).toBeNull();
    openSpy.mockRestore();
  });
});
