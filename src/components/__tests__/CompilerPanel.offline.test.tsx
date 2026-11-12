// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompilerPanel } from "../CompilerPanel";
import { useStudioStore } from "../../store/useStudioStore";
import * as client from "../../api/client";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    fetchDatasets: vi.fn(),
    fetchCompilerPresets: vi.fn(),
    fetchModernizationQueue: vi.fn(),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocked = vi.mocked(client);

describe("CompilerPanel without the Dataset Compiler sidecar", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useStudioStore.setState({ cachedDatasets: [] });
    mocked.fetchDatasets.mockResolvedValue([]);
    mocked.fetchCompilerPresets.mockResolvedValue([]);
    mocked.fetchModernizationQueue.mockResolvedValue([]);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("shows an empty offline state instead of a fake catalog", async () => {
    await act(async () => {
      root.render(<CompilerPanel datasetCompilerOnline={false} />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain("the Dataset Compiler sidecar is offline");
    expect(container.textContent).not.toContain("upn_v2");
    expect(useStudioStore.getState().cachedDatasets).toEqual([]);
  });

  it("gives the sub-tabs and standard compile overrides their registry IDs", async () => {
    await act(async () => {
      root.render(<CompilerPanel datasetCompilerOnline={false} />);
    });
    for (const id of [
      "compiler-subtabs-tab-catalog",
      "compiler-subtabs-tab-queue",
      "compiler-subtabs-tab-reduce",
      "comp-input-max-gb",
      "comp-input-workers",
      "comp-select-shard-ext",
      "compiler-btn-validate-schema",
    ]) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });
});
