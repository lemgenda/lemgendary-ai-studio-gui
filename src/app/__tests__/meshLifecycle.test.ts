import { beforeEach, describe, expect, it, vi } from "vitest";
import { PipelineEvent } from "../../api/types";
import { servicePort } from "../../api/config";

const probe = vi.hoisted(() => vi.fn<(id: string) => Promise<boolean>>());
const startService = vi.hoisted(() => vi.fn());
const startAllServices = vi.hoisted(() => vi.fn());

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  probeSidecarPort: probe,
  startService,
  startAllServices,
}));

import { ServiceStartTimeoutError, offlineServices, startOfflineServices } from "../serviceStartup";
import { waitUntil } from "../waitForMesh";
import { appendLiveEvent, eventKey, mergeRecentEvents } from "../eventLog";
import { refreshErrorMessage } from "../useMeshSync";

const FAST = { attempts: 3, intervalMs: 0 };

/** Probe answers from a mutable set of online service ids. */
function meshWith(online: Set<string>) {
  probe.mockImplementation(async (id: string) => online.has(id));
}

beforeEach(() => {
  probe.mockReset();
  startService.mockReset();
  startAllServices.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("waitUntil", () => {
  it("resolves true once the check holds and false on timeout", async () => {
    let n = 0;
    expect(await waitUntil(async () => ++n === 2, FAST)).toBe(true);
    expect(await waitUntil(async () => false, FAST)).toBe(false);
  });

  it("stops when cancelled", async () => {
    const check = vi.fn(async () => false);
    expect(await waitUntil(check, { ...FAST, isCancelled: () => true })).toBe(false);
    expect(check).not.toHaveBeenCalled();
  });
});

describe("startOfflineServices (D17: probes each service, env manager first)", () => {
  it("does nothing when every service answers", async () => {
    meshWith(new Set(["env-manager", "dataset-compiler", "training-suite"]));
    expect(await startOfflineServices(FAST)).toEqual([]);
    expect(startService).not.toHaveBeenCalled();
    expect(startAllServices).not.toHaveBeenCalled();
  });

  it("starts the Environment Manager first when the whole mesh is down, then lets it start the rest", async () => {
    const online = new Set<string>();
    meshWith(online);
    startService.mockImplementation(async (id: string) => online.add(id));
    startAllServices.mockImplementation(async () => {
      online.add("dataset-compiler");
      online.add("training-suite");
    });

    expect(await offlineServices()).toEqual(["env-manager", "dataset-compiler", "training-suite"]);
    expect(await startOfflineServices(FAST)).toEqual(["env-manager", "dataset-compiler", "training-suite"]);
    expect(startService).toHaveBeenCalledWith("env-manager");
    expect(startAllServices).toHaveBeenCalledTimes(1);
  });

  it("spawns the rest one by one when the Environment Manager never answers", async () => {
    const online = new Set<string>();
    meshWith(online);
    startService.mockImplementation(async (id: string) => {
      if (id !== "env-manager") online.add(id);
    });

    await expect(startOfflineServices(FAST)).rejects.toBeInstanceOf(ServiceStartTimeoutError);
    expect(startService.mock.calls.map((c) => c[0])).toEqual(["env-manager", "dataset-compiler", "training-suite"]);
    expect(startAllServices).not.toHaveBeenCalled();
  });

  it("asks the running Environment Manager to start only when a sidecar is down", async () => {
    const online = new Set(["env-manager", "training-suite"]);
    meshWith(online);
    startAllServices.mockImplementation(async () => online.add("dataset-compiler"));
    expect(await startOfflineServices(FAST)).toEqual(["dataset-compiler"]);
    expect(startService).not.toHaveBeenCalled();
  });

  it("names the services that did not answer (D16)", async () => {
    meshWith(new Set(["env-manager"]));
    startAllServices.mockResolvedValue({ results: {} });
    await expect(startOfflineServices(FAST)).rejects.toThrow(
      /LemGendary Dataset Compiler Suite, LemGendary Model Training Suite did not answer within 0 s/
    );
  });
});

describe("event log merge (D18)", () => {
  const live: PipelineEvent = {
    timestamp: "2026-11-03T10:00:00Z",
    step_number: 2,
    total_steps: 7,
    step_name: "Virtual Environments",
    status: "info",
    message: "Creating venv",
    is_progress: false,
    origin: "env-manager",
    port: servicePort("env-manager"),
  };

  it("drops REST events already received over the WebSocket and tags new ones like WebSocket events", () => {
    const rest = [
      { ...live, origin: undefined, port: undefined },
      { timestamp: "2026-11-03T10:00:01Z", step_number: 2, total_steps: 7, step_name: "Virtual Environments", status: "success", message: "Done" },
    ];
    const merged = mergeRecentEvents([live], rest);
    expect(merged.map(eventKey)).toEqual([eventKey(live), "2026-11-03T10:00:01Z|Virtual Environments|Done"]);
    expect(merged[1].origin).toBe("env-manager");
    expect(merged[1].port).toBe(servicePort("env-manager"));
    expect(mergeRecentEvents(merged, rest)).toHaveLength(2);
  });

  it("caps the buffer at 200 events", () => {
    let buf: PipelineEvent[] = [];
    for (let i = 0; i < 250; i++) buf = appendLiveEvent(buf, { ...live, message: `line ${i}` });
    expect(buf).toHaveLength(200);
    expect(buf[199].message).toBe("line 249");
  });
});

describe("refreshErrorMessage (D14)", () => {
  const labels = ["Hardware profile", "Health report", "Pipeline status"];

  it("is null when every source loaded", () => {
    const ok: PromiseSettledResult<unknown> = { status: "fulfilled", value: {} };
    expect(refreshErrorMessage(labels, [ok, ok, ok])).toBeNull();
  });

  it("names every failed source and the first error", () => {
    const ok: PromiseSettledResult<unknown> = { status: "fulfilled", value: {} };
    const down: PromiseSettledResult<unknown> = { status: "rejected", reason: new TypeError("Failed to fetch") };
    expect(refreshErrorMessage(labels, [down, ok, down])).toBe(
      "Refresh incomplete: Hardware profile, Pipeline status could not be loaded from the Environment Manager (Failed to fetch)."
    );
  });
});
