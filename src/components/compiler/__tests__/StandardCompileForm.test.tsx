// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StandardCompileForm } from "../StandardCompileForm";
import type { CompilerPreset, DatasetItem } from "../../../api/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SAMPLE_PRESETS: CompilerPreset[] = [
  {
    name: "forex-timeseries",
    title: "Forex & Commodities Time-Series (MT5 -> Parquet)",
    description: "Multi-timeframe OHLCV ingestion",
    image_format: "webp",
    image_quality: 92,
  },
  {
    name: "quality-vision",
    title: "Quality Vision",
    description: "Standard vision preset",
    image_format: "webp",
    image_quality: 95,
  },
];

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

describe("StandardCompileForm", () => {
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

  it("updates both selected manifold and preset when user changes dropdown", async () => {
    const onSelectManifold = vi.fn();
    const onSelectPreset = vi.fn();

    await act(async () => {
      root.render(
        <StandardCompileForm
          datasets={SAMPLE_DATASETS}
          presets={SAMPLE_PRESETS}
          presetsError={null}
          selectedManifold="upn_v2"
          onSelectManifold={onSelectManifold}
          selectedPreset="restoration-hardlinked"
          onSelectPreset={onSelectPreset}
          compileMaxGb=""
          onChangeCompileMaxGb={vi.fn()}
          compileWorkers="4"
          onChangeCompileWorkers={vi.fn()}
          compileShardExt=""
          onChangeCompileShardExt={vi.fn()}
          isCompiling={false}
          compileStatus={null}
          onCompile={vi.fn()}
          datasetCompilerOnline={true}
        />
      );
    });

    const select = container.querySelector("#comp-select-manifold") as HTMLSelectElement;
    expect(select).not.toBeNull();

    await act(async () => {
      select.value = "forex_universe";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onSelectManifold).toHaveBeenCalledWith("forex_universe");
    expect(onSelectPreset).toHaveBeenCalledWith("forex-timeseries");
  });

  it("renders dismissible compileStatus banner and triggers onDismissCompileStatus", async () => {
    const onDismissCompileStatus = vi.fn();

    await act(async () => {
      root.render(
        <StandardCompileForm
          datasets={SAMPLE_DATASETS}
          presets={SAMPLE_PRESETS}
          presetsError={null}
          selectedManifold="upn_v2"
          onSelectManifold={vi.fn()}
          selectedPreset="restoration-hardlinked"
          onSelectPreset={vi.fn()}
          compileMaxGb=""
          onChangeCompileMaxGb={vi.fn()}
          compileWorkers="4"
          onChangeCompileWorkers={vi.fn()}
          compileShardExt=""
          onChangeCompileShardExt={vi.fn()}
          isCompiling={false}
          compileStatus="Compilation failed: Invalid limits"
          onDismissCompileStatus={onDismissCompileStatus}
          onCompile={vi.fn()}
          datasetCompilerOnline={true}
        />
      );
    });

    const dismissBtn = container.querySelector(".btn-dismiss-icon") as HTMLButtonElement;
    expect(dismissBtn).not.toBeNull();
    expect(dismissBtn.getAttribute("aria-label")).toBe("Dismiss banner");

    await act(async () => {
      dismissBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onDismissCompileStatus).toHaveBeenCalledTimes(1);
  });
});
