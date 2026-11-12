// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompilerPanel } from "../CompilerPanel";
import { useStudioStore } from "../../store/useStudioStore";
import * as client from "../../api/client";
import { DatasetItem, DatasetJobResponse } from "../../api/types";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    fetchDatasets: vi.fn(),
    fetchCompilerPresets: vi.fn(),
    fetchModernizationQueue: vi.fn(),
    triggerQuickCompile: vi.fn(),
    validateCompilerConfig: vi.fn(),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocked = vi.mocked(client);

const DATASET: DatasetItem = {
  key: "upn_v2",
  display_name: "UpnV2",
  format: "directory",
  canonical_format: "webdataset",
  total_samples: 10,
  total_size_mb: 1,
  format_breakdown: { webp: 10, jpg: 0, png: 0, parquet: 0, other: 0 },
  is_compiled: false,
};

const JOB: DatasetJobResponse = {
  id: "job-7",
  job_type: "compile",
  state: "pending",
  created_at: "2026-11-12T10:00:00Z",
  log_file: "logs/job-7.log",
};

describe("CompilerPanel schema validation and shard extension", () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = async (online: boolean) => {
    await act(async () => {
      root.render(<CompilerPanel datasetCompilerOnline={online} />);
    });
    await act(async () => {
      await Promise.resolve();
    });
  };

  const click = async (id: string) => {
    await act(async () => {
      (document.getElementById(id) as HTMLButtonElement).click();
    });
  };

  const banners = () => Array.from(container.querySelectorAll(".validation-banner"));

  beforeEach(() => {
    useStudioStore.setState({ cachedDatasets: [] });
    mocked.fetchDatasets.mockResolvedValue([DATASET]);
    mocked.fetchCompilerPresets.mockResolvedValue([]);
    mocked.fetchModernizationQueue.mockResolvedValue([]);
    mocked.triggerQuickCompile.mockResolvedValue(JOB);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("shows the validation summary as a success notice", async () => {
    mocked.validateCompilerConfig.mockResolvedValue({
      status: "valid",
      version: "3.1",
      prefix: "LemGendized",
      suffix: "",
      output_folder: "LemGendaryDatasets",
      dataset_count: 42,
    });
    await render(true);
    await click("compiler-btn-validate-schema");
    const success = banners().find((b) => b.classList.contains("banner-success"));
    expect(success?.textContent).toContain("Schema valid: unified_data.yaml v3.1, 42 datasets");
  });

  it("shows a schema error as an error banner", async () => {
    mocked.validateCompilerConfig.mockRejectedValue(new Error("Configuration schema validation failed: bad key"));
    await render(true);
    await click("compiler-btn-validate-schema");
    const error = banners().find((b) => b.classList.contains("banner-error"));
    expect(error?.textContent).toContain("Schema validation failed: Configuration schema validation failed: bad key");
  });

  it("disables Validate Schema while the compiler is offline", async () => {
    await render(false);
    const button = document.getElementById("compiler-btn-validate-schema") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(mocked.validateCompilerConfig).not.toHaveBeenCalled();
  });

  it("omits shard_ext for the compiler default", async () => {
    await render(true);
    const select = document.getElementById("comp-select-shard-ext") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["", "data", "tar"]);
    await click("comp-btn-compile");
    expect(mocked.triggerQuickCompile).toHaveBeenCalledWith({ model: "upn_v2" });
  });

  it("sends the chosen shard extension as shard_ext", async () => {
    await render(true);
    const select = document.getElementById("comp-select-shard-ext") as HTMLSelectElement;
    act(() => {
      select.value = "tar";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await click("comp-btn-compile");
    expect(mocked.triggerQuickCompile).toHaveBeenCalledWith({ model: "upn_v2", shard_ext: "tar" });
  });
});
