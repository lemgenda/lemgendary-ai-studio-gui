import { describe, it, expect, vi, afterEach } from "vitest";
import {
  MESH_SERVICES,
  fetchCompilerPresets,
  fetchModernizationQueue,
  parseCompilerPresets,
  parseModernizationQueue,
  sidecarErrorDetail,
  triggerCustomCompile,
  triggerManifoldReduce,
  triggerModernizationRun,
  triggerQuickCompile,
  validateCompilerConfig,
} from "../client";
import { CLIENT_HEADER, CLIENT_HEADER_VALUE } from "../http";

/**
 * Field names of the Dataset Compiler request models, copied from
 * `lemgendary-datasets/openapi.json` (the sidecar is the source of truth; the GUI adapts).
 */
const SERVER_FIELDS = {
  QuickCompileRequest: ["model", "preset", "max_gb", "workers", "shard_ext"],
  CustomCompileRequest: ["custom_name", "task", "preset", "canonical_format", "shard_size", "sources", "purge_loose_images"],
  ModernizeRunRequest: ["datasets", "dataset", "workers", "mds_shard_mb", "purge_loose", "push_kaggle", "dry_run", "force"],
  ManifoldReduceRequest: ["dataset_key", "manifold", "scale", "workers", "max_gb", "suffix", "dry_run"],
} as const;

const BASE = MESH_SERVICES["dataset-compiler"].httpUrl;

const JOB = {
  id: "job-123",
  job_type: "compile",
  state: "pending",
  created_at: "2026-11-03T10:00:00Z",
  log_file: "logs/job-123.log",
  parameters: {},
};

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentBody(fetchMock: ReturnType<typeof stubFetch>): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[0];
  return JSON.parse(String((init as RequestInit).body)) as Record<string, unknown>;
}

describe("Dataset Compiler contract (DS D-07)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("quick-compile sends `model` (not `manifold_key`) and returns the job `id`", async () => {
    const fetchMock = stubFetch(JOB);
    const job = await triggerQuickCompile({ model: "upn_v2", preset: "quality-vision" });
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/api/gui/quick-compile`);
    const body = sentBody(fetchMock);
    expect(body).toEqual({ model: "upn_v2", preset: "quality-vision" });
    expect(Object.keys(body).every((k) => (SERVER_FIELDS.QuickCompileRequest as readonly string[]).includes(k))).toBe(true);
    expect(job.id).toBe("job-123");
  });

  it("quick-compile forwards `shard_ext` when one is chosen", async () => {
    const fetchMock = stubFetch(JOB);
    await triggerQuickCompile({ model: "upn_v2", shard_ext: "tar" });
    const body = sentBody(fetchMock);
    expect(body).toEqual({ model: "upn_v2", shard_ext: "tar" });
    expect(Object.keys(body).every((k) => (SERVER_FIELDS.QuickCompileRequest as readonly string[]).includes(k))).toBe(true);
  });

  it("schema validation POSTs to /api/config/validate with the client header and no token", async () => {
    const summary = {
      status: "valid",
      version: "3.1",
      prefix: "LemGendized",
      suffix: "",
      output_folder: "LemGendaryDatasets",
      dataset_count: 42,
    };
    const fetchMock = stubFetch(summary);
    expect(await validateCompilerConfig()).toEqual(summary);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/config/validate`);
    const request = init as RequestInit;
    expect(request.method).toBe("POST");
    expect(request.body).toBeUndefined();
    const headers = new Headers(request.headers);
    expect(headers.get(CLIENT_HEADER)).toBe(CLIENT_HEADER_VALUE);
    expect(headers.has("Authorization")).toBe(false);
  });

  it("schema validation surfaces the server's 422 schema error", async () => {
    stubFetch({ detail: "Configuration schema validation failed: datasets.0.key missing" }, 422);
    await expect(validateCompilerConfig()).rejects.toThrow("Configuration schema validation failed: datasets.0.key missing");
  });

  it("custom-compile only sends server fields and may omit `preset` for the server default", async () => {
    const fetchMock = stubFetch({ ...JOB, job_type: "custom" });
    await triggerCustomCompile({
      custom_name: "CustomFaceEnhance",
      task: "restoration",
      canonical_format: "webdataset",
      shard_size: 5000,
      sources: ["kaggle://owner/data"],
      purge_loose_images: true,
    });
    const body = sentBody(fetchMock);
    expect(body).not.toHaveProperty("preset");
    expect(Object.keys(body).every((k) => (SERVER_FIELDS.CustomCompileRequest as readonly string[]).includes(k))).toBe(true);
  });

  it("custom-compile surfaces the server's 422 detail for an unknown preset", async () => {
    stubFetch({ detail: "Unknown compiler preset 'nope'. Valid presets: quality-vision, restoration-hardlinked" }, 422);
    await expect(
      triggerCustomCompile({ custom_name: "X", preset: "nope", sources: ["kaggle://a/b"] })
    ).rejects.toThrow("Unknown compiler preset 'nope'. Valid presets: quality-vision, restoration-hardlinked");
  });

  it("modernize and reduce bodies use the server field names", async () => {
    const fetchMock = stubFetch(JOB);
    await triggerModernizationRun({ dataset: "upn_v2", workers: 4, push_kaggle: false, force: false, dry_run: true });
    await triggerManifoldReduce({ manifold: "LemGendizedUPN", scale: 0.25 });
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)) as Record<string, unknown>);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([`${BASE}/api/modernize/run`, `${BASE}/api/modernize/reduce`]);
    expect(Object.keys(bodies[0]).every((k) => (SERVER_FIELDS.ModernizeRunRequest as readonly string[]).includes(k))).toBe(true);
    expect(bodies[1]).toEqual({ manifold: "LemGendizedUPN", scale: 0.25 });
    expect(Object.keys(bodies[1]).every((k) => (SERVER_FIELDS.ManifoldReduceRequest as readonly string[]).includes(k))).toBe(true);
  });

  it("parses presets from the dict the server returns", async () => {
    stubFetch({
      presets: {
        "restoration-hardlinked": { name: "restoration-hardlinked", title: "Restoration", description: "d", image_format: "webp", image_quality: 95 },
        "quality-vision": { name: "quality-vision", title: "Quality Vision", description: "d", image_format: "webp", image_quality: 92 },
      },
      total: 2,
    });
    const presets = await fetchCompilerPresets();
    expect(presets.map((p) => p.name)).toEqual(["quality-vision", "restoration-hardlinked"]);
  });

  it("rejects a preset response that is not the dict shape", () => {
    expect(() => parseCompilerPresets({ presets: [] })).toThrow("PresetListResponse");
  });

  it("throws instead of hiding a preset request failure", async () => {
    stubFetch({ detail: "Compiler presets are unusable: bad yaml" }, 500);
    await expect(fetchCompilerPresets()).rejects.toThrow("Compiler presets are unusable: bad yaml");
  });

  it("parses the modernization queue as a bare list", async () => {
    const item = {
      key: "upn_v2",
      name: "LemGendizedUPN",
      canonical_format: "webdataset",
      modernized_folder: "LemGendizedUPN",
      kaggle_ref: "lemgenda/upn",
      title: "UPN",
      subtitle: "",
      is_containerized: false,
      has_loose_files: true,
      container_bytes: 0,
      container_gb: 0,
      status_label: "PENDING PACK",
      source_label: "Loose WebP/Images",
    };
    stubFetch([item]);
    expect(await fetchModernizationQueue()).toEqual([item]);
    expect(() => parseModernizationQueue({ queue: [item] })).toThrow("not a list");
  });

  it("formats FastAPI validation details", () => {
    const detail = [{ loc: ["body", "model"], msg: "Field required", type: "missing" }];
    expect(sidecarErrorDetail({ detail }, "fallback")).toBe("model: Field required");
    expect(sidecarErrorDetail(null, "fallback")).toBe("fallback");
  });
});
