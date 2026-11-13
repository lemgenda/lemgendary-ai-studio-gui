import { afterEach, describe, expect, it, vi } from "vitest";
import openapi from "../../../../lemgendary-training-suite/openapi.json";
import {
  MESH_SERVICES,
  fetchKaggleAccelerators,
  fetchKaggleSuiteStatus,
  fetchModelKaggleHandles,
  launchKaggleTrain,
  monitorKaggleKernel,
  pushKaggleModelVariation,
  snapshotKaggleAccelerators,
  triggerQuickTrain,
} from "../client";
import { ECOSYSTEM } from "../ecosystem";
import { KAGGLE_MAX_RESUMES_MIN, KAGGLE_POLL_DEFAULT_SECONDS, KAGGLE_POLL_MIN_SECONDS, VARIATION_KEYS } from "../types";

/**
 * Training Suite Kaggle contract: the GUI mirrors these values from
 * `lemgendary-training-suite/openapi.json` (the sidecar is the source of truth).
 */
const schemas = openapi.components.schemas;
const BASE = MESH_SERVICES["training-suite"].httpUrl;

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentBody(fetchMock: ReturnType<typeof stubFetch>): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[0];
  return JSON.parse(String((init as RequestInit).body)) as Record<string, unknown>;
}

describe("Training Suite Kaggle contract (R3-K)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("mirrors the OpenAPI VariationKey enum exactly", () => {
    expect([...VARIATION_KEYS]).toEqual(schemas.VariationKey.enum);
  });

  it("mirrors the KaggleTrainRequest poll interval default and minimum", () => {
    const poll = schemas.KaggleTrainRequest.properties.poll_interval;
    expect(KAGGLE_POLL_DEFAULT_SECONDS).toBe(poll.default);
    expect(KAGGLE_POLL_MIN_SECONDS).toBe(poll.minimum);
  });

  it("launch sends only KaggleTrainRequest fields (accelerator, no gpu, username or key)", async () => {
    const fetchMock = stubFetch({ job_id: "job-1", status: "pending", message: "queued", model: "upn_v2" });
    await launchKaggleTrain({ model: "upn_v2", accelerator: "gpu-t4x2", auto_pull: true, poll_interval: 30 });
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/api/training/kaggle/train`);
    const body = sentBody(fetchMock);
    const serverFields = Object.keys(schemas.KaggleTrainRequest.properties);
    expect(Object.keys(body).every((k) => serverFields.includes(k))).toBe(true);
    expect(body).toEqual({ model: "upn_v2", accelerator: "gpu-t4x2", auto_pull: true, poll_interval: 30 });
  });

  it("launch sends the auto-resume options as KaggleTrainRequest fields", async () => {
    const props = schemas.KaggleTrainRequest.properties;
    expect(props.auto_resume.anyOf.map((t) => t.type)).toEqual(["boolean", "null"]);
    const maxResumes = props.max_resumes.anyOf.find((t) => t.type === "integer");
    expect(maxResumes?.minimum).toBe(KAGGLE_MAX_RESUMES_MIN);
    const fetchMock = stubFetch({ job_id: "job-2", status: "pending", message: "queued", model: "upn_v2" });
    await launchKaggleTrain({ model: "upn_v2", poll_interval: 30, auto_resume: true, max_resumes: 2 });
    const body = sentBody(fetchMock);
    expect(Object.keys(body).every((k) => Object.keys(props).includes(k))).toBe(true);
    expect(body).toMatchObject({ auto_resume: true, max_resumes: 2 });
  });

  it("launch sends the frozen settings override as KaggleTrainRequest.override_frozen", async () => {
    const field = schemas.KaggleTrainRequest.properties.override_frozen;
    expect(field.type).toBe("boolean");
    expect(field.default).toBe(false);
    const fetchMock = stubFetch({ job_id: "job-4", status: "pending", message: "queued", model: "upn_v2" });
    await launchKaggleTrain({ model: "upn_v2", poll_interval: 30, override_frozen: true });
    expect(sentBody(fetchMock)).toMatchObject({ override_frozen: true });
  });

  it("quick-train sends the frozen settings override as QuickTrainRequest.override_frozen", async () => {
    const props = schemas.QuickTrainRequest.properties;
    expect(props.override_frozen.type).toBe("boolean");
    expect(props.override_frozen.default).toBe(false);
    const fetchMock = stubFetch({ status: "pending", job_id: "job-5" });
    await triggerQuickTrain({ model_key: "upn_v2", batch_size: 8, override_frozen: true });
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/api/gui/quick-train`);
    const body = sentBody(fetchMock);
    expect(Object.keys(body).every((k) => Object.keys(props).includes(k))).toBe(true);
    expect(body).toEqual({ model_key: "upn_v2", batch_size: 8, override_frozen: true });
  });

  it("monitor sends only KaggleMonitorRequest fields, poll interval included", async () => {
    const fetchMock = stubFetch({ job_id: "job-3", status: "pending", message: "attached", kernel_slug: "o/k" });
    await monitorKaggleKernel({ kernel_slug: "o/k", model: "upn_v2", auto_pull: false, poll_interval: 60 });
    const body = sentBody(fetchMock);
    const serverFields = Object.keys(schemas.KaggleMonitorRequest.properties);
    expect(Object.keys(body).every((k) => serverFields.includes(k))).toBe(true);
    expect(body.poll_interval).toBe(60);
  });

  it("push-model sends a VariationKey and only KagglePushModelRequest fields", async () => {
    const fetchMock = stubFetch({ model_key: "upn_v2", success: true, variations: {}, errors: [] });
    await pushKaggleModelVariation({ model: "upn_v2", variation: "pytorch/default", dry_run: true });
    const body = sentBody(fetchMock);
    const serverFields = Object.keys(schemas.KagglePushModelRequest.properties);
    expect(Object.keys(body).every((k) => serverFields.includes(k))).toBe(true);
    expect(schemas.VariationKey.enum).toContain(body.variation);
  });

  it("the ecosystem snapshot offers the accelerators the backend serves (no retired shapes)", () => {
    const list = snapshotKaggleAccelerators();
    expect(list.default).toBe(ECOSYSTEM.kaggle.default_accelerator);
    expect(list.accelerators.map((a) => a.id)).toEqual(["cpu", "gpu-t4x2", "tpu-v5e8"]);
    expect(list.accelerators.some((a) => a.machine_shape === "NvidiaTeslaP100")).toBe(false);
  });
});

describe("fetchKaggleAccelerators", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the Training Suite route when it answers", async () => {
    const served = { default: "cpu", accelerators: [{ id: "cpu", label: "CPU", kind: "cpu", machine_shape: null }] };
    const fetchMock = stubFetch(served);
    const choices = await fetchKaggleAccelerators();
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/api/training/kaggle/accelerators`);
    expect(choices).toEqual({ list: served, source: "sidecar" });
  });

  it("falls back to the ecosystem snapshot while the Training Suite is offline", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => {
      throw new TypeError("connection refused");
    }));
    const choices = await fetchKaggleAccelerators();
    expect(choices.source).toBe("snapshot");
    expect(choices.list).toEqual(snapshotKaggleAccelerators());
  });
});

describe("fetchKaggleSuiteStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows the real probe outcome as sent, never forcing authenticated", async () => {
    stubFetch({
      authenticated: false,
      username: "alice",
      token_configured: true,
      auth_method: "access_token",
      http_status: 401,
      error: "Unauthorized",
    });
    const status = await fetchKaggleSuiteStatus();
    expect(status).toEqual({
      authenticated: false,
      username: "alice",
      token_configured: true,
      auth_method: "access_token",
      http_status: 401,
      error: "Unauthorized",
    });
  });

  it("reads an unreachable Training Suite as unauthenticated with the reason", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    stubFetch({}, 503);
    const status = await fetchKaggleSuiteStatus();
    expect(status.authenticated).toBe(false);
    expect(status.error).toContain("HTTP 503");
  });
});

describe("fetchModelKaggleHandles", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reads the registry slug and dataset URLs from GET /api/models/{key}", async () => {
    const fetchMock = stubFetch({
      kaggle_metadata: { slug: "nima-aesthetic-mobile" },
      kaggle_dataset_urls: ["https://www.kaggle.com/datasets/owner/lemgendizednimaaesthetic"],
    });
    const handles = await fetchModelKaggleHandles("nima_aesthetics_mobile");
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/api/models/nima_aesthetics_mobile`);
    expect(handles).toEqual({
      slug: "nima-aesthetic-mobile",
      datasetUrls: ["https://www.kaggle.com/datasets/owner/lemgendizednimaaesthetic"],
    });
  });

  it("uses the Training Suite slug fallback when the registry has none", async () => {
    stubFetch({});
    expect(await fetchModelKaggleHandles("upn_v2")).toEqual({ slug: "upn-v2", datasetUrls: [] });
  });
});
