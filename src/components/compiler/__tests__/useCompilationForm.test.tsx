// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCompilationForm } from "../useCompilationForm";
import type { DatasetItem } from "../../../api/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SAMPLE_DATASETS: DatasetItem[] = [
  {
    key: "forex_universe",
    display_name: "LemGendized Forex Universe",
    modernized_folder: "LemGendizedForexUniverse",
    format: "parquet",
    canonical_format: "parquet",
    task: "forex",
    recommended_preset: "forex-timeseries",
    total_samples: 0,
    total_size_mb: 0,
    is_compiled: false,
    format_breakdown: { webp: 0, jpg: 0, png: 0, parquet: 0, other: 0 },
  },
  {
    key: "upn_v2",
    display_name: "LemGendized Upn V2",
    modernized_folder: "LemGendizedUpnV2",
    format: "webdataset",
    canonical_format: "webdataset",
    task: "restoration",
    total_samples: 5000,
    total_size_mb: 250,
    is_compiled: true,
    format_breakdown: { webp: 5000, jpg: 0, png: 0, parquet: 0, other: 0 },
  },
];

describe("useCompilationForm preset auto-selection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("automatically sets forex-timeseries preset when target manifold changes to forex", async () => {
    let currentPreset = "";

    function TestComponent({ manifold }: { manifold: string }) {
      const form = useCompilationForm({
        datasetCompilerOnline: true,
        selectedManifold: manifold,
        datasets: SAMPLE_DATASETS,
        addTelemetryLog: vi.fn(),
        reloadCatalog: vi.fn(),
      });
      currentPreset = form.selectedPreset;
      return <div data-testid="preset">{form.selectedPreset}</div>;
    }

    await act(async () => {
      root.render(<TestComponent manifold="upn_v2" />);
    });
    expect(currentPreset).toBe("restoration-hardlinked");

    await act(async () => {
      root.render(<TestComponent manifold="forex_universe" />);
    });
    expect(currentPreset).toBe("forex-timeseries");
  });
});
