import { describe, expect, it } from "vitest";
import { findDatasetByManifold, getRecommendedPreset } from "../presetHelpers";
import type { DatasetItem } from "../../../api/types";

describe("presetHelpers", () => {
  const sampleDatasets: DatasetItem[] = [
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
      key: "ai_helper_corpus",
      display_name: "LemGendized AI Helper Corpus",
      modernized_folder: "LemGendizedAiHelperCorpus",
      format: "jsonl",
      canonical_format: "jsonl",
      task: "ai_helper",
      total_samples: 0,
      total_size_mb: 0,
      is_compiled: false,
      format_breakdown: { webp: 0, jpg: 0, png: 0, parquet: 0, other: 0 },
    },
    {
      key: "quality_vision_dataset",
      display_name: "LemGendized Vision",
      modernized_folder: "LemGendizedVision",
      format: "webdataset",
      canonical_format: "webdataset",
      task: "classification",
      total_samples: 1000,
      total_size_mb: 50,
      is_compiled: true,
      format_breakdown: { webp: 1000, jpg: 0, png: 0, parquet: 0, other: 0 },
    },
  ];

  it("finds datasets by exact key, case-insensitive key, modernized folder, or display name", () => {
    expect(findDatasetByManifold(sampleDatasets, "forex_universe")?.key).toBe("forex_universe");
    expect(findDatasetByManifold(sampleDatasets, "FOREX_UNIVERSE")?.key).toBe("forex_universe");
    expect(findDatasetByManifold(sampleDatasets, "lemgendizedforexuniverse")?.key).toBe("forex_universe");
    expect(findDatasetByManifold(sampleDatasets, "LemGendized Forex Universe")?.key).toBe("forex_universe");
    expect(findDatasetByManifold(sampleDatasets, "unknown")).toBeUndefined();
  });

  it("recommends forex-timeseries for forex parquet manifolds", () => {
    expect(getRecommendedPreset(sampleDatasets[0])).toBe("forex-timeseries");
  });

  it("recommends llm-instruction for jsonl NLP manifolds", () => {
    expect(getRecommendedPreset(sampleDatasets[1])).toBe("llm-instruction");
  });

  it("recommends quality-vision for default vision manifolds", () => {
    expect(getRecommendedPreset(sampleDatasets[2])).toBe("quality-vision");
  });
});
