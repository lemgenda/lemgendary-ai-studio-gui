import React, { useState, useEffect, useCallback } from "react";
import { HelpTooltip } from "./HelpTooltip";
import {
  fetchDatasets,
  fetchCompilerPresets,
  triggerQuickCompile,
  triggerCustomCompile,
  fetchKaggleStatus,
  fetchKaggleRegistryDatasets,
  downloadKaggleDataset,
  uploadKaggleDataset,
  updateKaggleMetadata,
} from "../api/client";
import {
  CompilerPreset,
  DatasetItem,
  KaggleDatasetRegistryItem,
  KaggleStatusResponse,
} from "../api/types";

interface CompilerPanelProps {
  datasetCompilerOnline: boolean;
}

export const CompilerPanel: React.FC<CompilerPanelProps> = ({ datasetCompilerOnline }) => {
  // Production Datasets & Presets
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [presets, setPresets] = useState<CompilerPreset[]>([]);
  const [selectedManifold, setSelectedManifold] = useState<string>("");
  const [selectedPreset, setSelectedPreset] = useState<string>("streaming-webdataset");
  const [shardSize, setShardSize] = useState<number>(5000);
  const [purgeLooseImages, setPurgeLooseImages] = useState<boolean>(true);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compileStatus, setCompileStatus] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshFeedback, setRefreshFeedback] = useState<string | null>(null);

  // Compilation Mode (Standard vs Custom Multi-Source)
  const [compileMode, setCompileMode] = useState<"standard" | "custom">("standard");
  const [customName, setCustomName] = useState<string>("");
  const [customTask, setCustomTask] = useState<string>("restoration");
  const [customPreset, setCustomPreset] = useState<string>("streaming-webdataset");
  const [customCanonicalFormat, setCustomCanonicalFormat] = useState<"webdataset" | "parquet" | "mds" | "litdata">("webdataset");
  const [customShardSize, setCustomShardSize] = useState<number>(5000);
  const [customSourcesText, setCustomSourcesText] = useState<string>("");
  const [customPurgeLoose, setCustomPurgeLoose] = useState<boolean>(true);
  const [isCustomCompiling, setIsCustomCompiling] = useState<boolean>(false);
  const [customCompileStatus, setCustomCompileStatus] = useState<string | null>(null);

  // Kaggle Sync Hub State
  const [kaggleStatus, setKaggleStatus] = useState<KaggleStatusResponse | null>(null);
  const [kaggleRegistry, setKaggleRegistry] = useState<KaggleDatasetRegistryItem[]>([]);
  const [kaggleActiveTab, setKaggleActiveTab] = useState<"download" | "upload" | "metadata">("download");
  const [kaggleDownloadMode, setKaggleDownloadMode] = useState<"registry" | "custom">("registry");
  const [selectedRegistryKey, setSelectedRegistryKey] = useState<string>("");
  const [customKaggleRef, setCustomKaggleRef] = useState<string>("");
  const [downloadTargetFolder, setDownloadTargetFolder] = useState<string>("");
  const [downloadForce, setDownloadForce] = useState<boolean>(false);
  const [isDownloadingKaggle, setIsDownloadingKaggle] = useState<boolean>(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  const [uploadManifold, setUploadManifold] = useState<string>("");
  const [uploadKaggleRef, setUploadKaggleRef] = useState<string>("");
  const [isUploadingKaggle, setIsUploadingKaggle] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Metadata update state
  const [metaUpdateMode, setMetaUpdateMode] = useState<"single" | "all">("single");
  const [metaUpdateManifold, setMetaUpdateManifold] = useState<string>("");
  const [metaUpdateRef, setMetaUpdateRef] = useState<string>("");
  const [isUpdatingMeta, setIsUpdatingMeta] = useState<boolean>(false);
  const [metaUpdateStatus, setMetaUpdateStatus] = useState<string | null>(null);

  const loadCompilerData = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshFeedback(null);
    try {
      const [dsList, prList, kStatus, kReg] = await Promise.all([
        fetchDatasets(),
        fetchCompilerPresets(),
        fetchKaggleStatus(),
        fetchKaggleRegistryDatasets(),
      ]);

      if (dsList.length > 0) {
        setDatasets(dsList);
        setSelectedManifold((prev) => prev || dsList[0].key);
        setUploadManifold((prev) => prev || dsList[0].key);
        setMetaUpdateManifold((prev) => prev || dsList[0].key);
        setRefreshFeedback(`Catalog refreshed: ${dsList.length} production manifolds loaded.`);
      } else {
        // Fallback default manifolds from unified_data.yaml
        const fallbackDatasets: DatasetItem[] = [
          { key: "mirnet_exposure", display_name: "MIRNet Low-Light & Exposure", format: "webdataset", canonical_format: "webdataset", total_samples: 1416459, total_size_mb: 87840, format_breakdown: { webp: 1416459, jpg: 0, png: 0, parquet: 0, other: 0 }, shards_count: 283, is_compiled: true },
          { key: "upn_v2", display_name: "Unified Perceptual Net V2", format: "webdataset", canonical_format: "webdataset", total_samples: 1378070, total_size_mb: 53600, format_breakdown: { webp: 1378070, jpg: 0, png: 0, parquet: 0, other: 0 }, shards_count: 285, is_compiled: true },
          { key: "nima_aesthetic", display_name: "NIMA Perceptual Aesthetics", format: "parquet", canonical_format: "parquet", total_samples: 321369, total_size_mb: 18200, format_breakdown: { webp: 321369, jpg: 0, png: 0, parquet: 65, other: 0 }, shards_count: 65, is_compiled: true },
          { key: "film_restorer", display_name: "Film Restorer & Scratch Removal", format: "webdataset", canonical_format: "webdataset", total_samples: 67542, total_size_mb: 28500, format_breakdown: { webp: 67542, jpg: 0, png: 0, parquet: 0, other: 0 }, shards_count: 14, is_compiled: true },
          { key: "yolov8n", display_name: "YOLOv8n Detection & Segmentation", format: "directory", canonical_format: "directory", total_samples: 153972, total_size_mb: 12400, format_breakdown: { webp: 0, jpg: 135659, png: 18313, parquet: 0, other: 0 }, shards_count: 0, is_compiled: true },
        ];
        setDatasets(fallbackDatasets);
        setSelectedManifold((prev) => prev || "upn_v2");
        setUploadManifold((prev) => prev || "upn_v2");
        if (!datasetCompilerOnline) {
          setRefreshFeedback("Dataset Compiler Sidecar (Port 8100) is offline. Displaying cached registry catalog.");
        }
      }

      if (prList.length > 0) {
        setPresets(prList);
      } else {
        setPresets([
          { id: "streaming-webdataset", name: "Streaming WebDataset Shards (.tar)", description: "High-throughput sequential chunking with lossless WebP encoding and zero NTFS lock contention.", target_format: "webdataset", shard_size: 5000, lossless: true },
          { id: "columnar-parquet", name: "Columnar HuggingFace Parquet (.parquet)", description: "Memory-mapped columnar binary format with snappy compression.", target_format: "parquet", shard_size: 10000, lossless: true },
          { id: "mosaicml-mds", name: "MosaicML Streaming Shards (.mds)", description: "Zero-latency streaming with zstd compression and fast random access.", target_format: "mds", shard_size: 5000, lossless: true },
          { id: "lightning-litdata", name: "PyTorch Lightning LitData (chunk*.bin)", description: "Optimized direct tensor serialization for distributed cloud storage.", target_format: "litdata", shard_size: 5000, lossless: true },
        ]);
      }

      setKaggleStatus(kStatus);
      if (kReg.length > 0) {
        setKaggleRegistry(kReg);
        setSelectedRegistryKey((prev) => prev || kReg[0].key);
      }
    } catch {
      setRefreshFeedback("Failed to query Dataset Compiler Sidecar (Port 8100).");
    } finally {
      setIsRefreshing(false);
    }
  }, [datasetCompilerOnline]);

  useEffect(() => {
    loadCompilerData();
  }, [loadCompilerData]);

  // Standard Compile Handler
  const handleCompile = async () => {
    if (!datasetCompilerOnline) {
      setCompileStatus("Compilation failed: Dataset Compiler Sidecar (Port 8100) is not reachable. Launch lemgendary-datasets to compile.");
      return;
    }
    setIsCompiling(true);
    setCompileStatus(null);
    try {
      const res = await triggerQuickCompile({
        manifold_key: selectedManifold,
        preset: selectedPreset,
        shard_size: shardSize,
        purge_loose_images: purgeLooseImages,
      });
      setCompileStatus(`Compilation initiated successfully (Job ID: ${res.job_id || "Active"}). Telemetry streaming to console.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setCompileStatus(`Compilation failed: ${msg}`);
    } finally {
      setIsCompiling(false);
    }
  };

  // Custom Multi-Source Compile Handler
  const handleCustomCompile = async () => {
    if (!datasetCompilerOnline) {
      setCustomCompileStatus("Custom compile failed: Dataset Compiler Sidecar (Port 8100) is not reachable.");
      return;
    }
    const trimmedName = customName.trim();
    if (!trimmedName) {
      setCustomCompileStatus("Please specify a custom manifold name.");
      return;
    }

    const rawLines = customSourcesText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));

    if (rawLines.length === 0) {
      setCustomCompileStatus("Please enter at least one source dataset reference or URL (Kaggle, HuggingFace, Google Drive, or GitHub).");
      return;
    }

    setIsCustomCompiling(true);
    setCustomCompileStatus(null);
    try {
      const res = await triggerCustomCompile({
        custom_name: trimmedName,
        task: customTask,
        preset: customPreset,
        canonical_format: customCanonicalFormat,
        shard_size: customShardSize,
        sources: rawLines,
        purge_loose_images: customPurgeLoose,
      });
      setCustomCompileStatus(`Custom compilation initiated successfully (Job ID: ${res.job_id || "Active"}). Added to unified_data.yaml.`);
      loadCompilerData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setCustomCompileStatus(`Custom compilation failed: ${msg}`);
    } finally {
      setIsCustomCompiling(false);
    }
  };

  // Kaggle Download Handler
  const handleKaggleDownload = async () => {
    if (!datasetCompilerOnline) {
      setDownloadStatus("Kaggle download failed: Dataset Compiler Sidecar (Port 8100) is offline.");
      return;
    }

    let targetRef = "";
    let defaultFolder = "";

    if (kaggleDownloadMode === "registry") {
      const item = kaggleRegistry.find((r) => r.key === selectedRegistryKey);
      if (!item) {
        setDownloadStatus("Please select a registry dataset to download.");
        return;
      }
      targetRef = item.clean_repo_id || item.kaggle_ref;
      defaultFolder = item.modernized_folder;
    } else {
      targetRef = customKaggleRef.trim();
      if (!targetRef) {
        setDownloadStatus("Please enter a Kaggle dataset link or repository slug (e.g. owner/dataset).");
        return;
      }
    }

    setIsDownloadingKaggle(true);
    setDownloadStatus(null);
    try {
      const res = await downloadKaggleDataset({
        kaggle_ref: targetRef,
        target_folder: downloadTargetFolder.trim() || defaultFolder || undefined,
        force: downloadForce,
      });
      setDownloadStatus(`Kaggle download initiated successfully (Job ID: ${res.job_id || "Active"}). Streaming from Kaggle API.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setDownloadStatus(`Download failed: ${msg}`);
    } finally {
      setIsDownloadingKaggle(false);
    }
  };

  // Kaggle Upload Handler
  const handleKaggleUpload = async () => {
    if (!datasetCompilerOnline) {
      setUploadStatus("Kaggle upload failed: Dataset Compiler Sidecar (Port 8100) is offline.");
      return;
    }
    if (!uploadManifold) {
      setUploadStatus("Please select a local manifold to upload.");
      return;
    }

    setIsUploadingKaggle(true);
    setUploadStatus(null);
    try {
      const res = await uploadKaggleDataset({
        manifold: uploadManifold,
        kaggle_ref: uploadKaggleRef.trim() || undefined,
      });
      setUploadStatus(`Kaggle upload initiated successfully (Job ID: ${res.job_id || "Active"}). Packaging manifold and pushing to Kaggle.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setUploadStatus(`Upload failed: ${msg}`);
    } finally {
      setIsUploadingKaggle(false);
    }
  };

  // Kaggle Metadata Update Handler
  const handleKaggleMetadataUpdate = async () => {
    if (!datasetCompilerOnline) {
      setMetaUpdateStatus("Metadata update failed: Dataset Compiler Sidecar (Port 8100) is offline.");
      return;
    }
    setIsUpdatingMeta(true);
    setMetaUpdateStatus(null);
    try {
      if (metaUpdateMode === "all") {
        const res = await updateKaggleMetadata({ all_datasets: true });
        setMetaUpdateStatus(`Metadata update initiated for ALL datasets (Job ID: ${res.job_id || "Active"}). Updating Kaggle descriptions, licenses and column schemas.`);
      } else {
        if (!metaUpdateManifold) {
          setMetaUpdateStatus("Please select a manifold to update.");
          return;
        }
        const res = await updateKaggleMetadata({
          manifold: metaUpdateManifold,
          kaggle_ref: metaUpdateRef.trim() || undefined,
        });
        setMetaUpdateStatus(`Metadata update initiated for ${metaUpdateManifold} (Job ID: ${res.job_id || "Active"}). Pushing title, description, license and column descriptors to Kaggle.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setMetaUpdateStatus(`Metadata update failed: ${msg}`);
    } finally {
      setIsUpdatingMeta(false);
    }
  };

  return (
    <div className="panel-container">
      {/* ─── SECTION 1: DATASET COMPILER & STORAGE MODERNIZATION ────────────── */}
      <div className="card">
        <div className="card-title">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600 }}>Dataset Compiler &amp; Storage Modernization</h3>
            <HelpTooltip content="Autonomous dataset synthesis engine. Compiles raw multi-source image collections into modern, self-contained streaming manifolds (WebDataset .tar, Parquet, MDS, LitData)." />
          </div>
          <span className="badge badge-info">Port 8100 Sidecar</span>
        </div>

        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
          Modernize raw archives into streaming containers with in-flight 12-thread WebP transcoding,
          automatic directory flattening, aspect-ratio quantization, and zero NTFS block overhead.
        </p>

        {/* Mode Selector: Standard vs Custom Multi-Source */}
        <div style={{ marginBottom: "20px" }}>
          <div className="segmented-control" style={{ maxWidth: "480px" }}>
            <button
              type="button"
              className={`segmented-btn ${compileMode === "standard" ? "active" : ""}`}
              onClick={() => setCompileMode("standard")}
            >
              Standard Manifold Compilation
            </button>
            <button
              type="button"
              className={`segmented-btn ${compileMode === "custom" ? "active" : ""}`}
              onClick={() => setCompileMode("custom")}
            >
              Custom Multi-Source Compilation
            </button>
          </div>
        </div>

        {/* Standard Mode Form */}
        {compileMode === "standard" && (
          <div>
            <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "20px" }}>
              <div className="form-group">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <label htmlFor="manifold-select" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Target Manifold:
                  </label>
                  <HelpTooltip content="Select the dataset manifold to synthesize or modernize. Sourced from unified_data.yaml." />
                </div>
                <select
                  id="manifold-select"
                  className="editor-select"
                  value={selectedManifold}
                  onChange={(e) => setSelectedManifold(e.target.value)}
                  disabled={isCompiling}
                >
                  {datasets.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.display_name} [{d.canonical_format || d.format}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <label htmlFor="preset-select" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Storage Format Preset:
                  </label>
                  <HelpTooltip content="Canonical storage architecture: WebDataset for sequential streaming, Parquet for metadata tables, MDS for fast random access, or LitData for tensor tensors." />
                </div>
                <select
                  id="preset-select"
                  className="editor-select"
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  disabled={isCompiling}
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <label htmlFor="shard-size-input" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Samples Per Shard:
                  </label>
                  <HelpTooltip content="Number of paired input/target samples serialized per container shard chunk. 5,000 samples typically produces 300-400MB shards, optimal for web streaming and memory mapping." />
                </div>
                <input
                  id="shard-size-input"
                  type="number"
                  className="editor-input"
                  value={shardSize}
                  onChange={(e) => setShardSize(Number(e.target.value))}
                  disabled={isCompiling}
                  min={100}
                  max={50000}
                />
              </div>

              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "24px" }}>
                <input
                  id="purge-loose-check"
                  type="checkbox"
                  checked={purgeLooseImages}
                  onChange={(e) => setPurgeLooseImages(e.target.checked)}
                  disabled={isCompiling}
                />
                <label htmlFor="purge-loose-check" style={{ fontSize: "13px", color: "var(--text-primary)", cursor: "pointer" }}>
                  Purge loose images post-compilation
                </label>
                <HelpTooltip content="When enabled, deletes redundant uncompressed loose image files (images/, targets/) after writing shards to eliminate dual-storage disk amplification." />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCompile}
                disabled={isCompiling || !datasetCompilerOnline}
                aria-label={!datasetCompilerOnline ? "Compile unavailable: Dataset Compiler Sidecar offline" : "Start dataset manifold compilation"}
                aria-disabled={!datasetCompilerOnline}
              >
                {isCompiling ? "Compiling Manifold..." : "Compile Manifold"}
              </button>
              <HelpTooltip content="Launch the high-throughput multi-threaded compilation process. Compiles samples, encodes WebP, builds indexes, and cleans up loose files." />

              <button
                type="button"
                className="btn btn-secondary"
                onClick={loadCompilerData}
                disabled={isCompiling || isRefreshing}
                aria-label="Refresh datasets list and format breakdown"
              >
                {isRefreshing ? "Refreshing Catalog..." : "Refresh Catalog"}
              </button>
            </div>

            {compileStatus && (
              <div className="validation-banner banner-success" style={{ marginTop: "16px" }} role="status">
                <span>{compileStatus}</span>
              </div>
            )}
          </div>
        )}

        {/* Custom Multi-Source Mode Form */}
        {compileMode === "custom" && (
          <div>
            <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "16px" }}>
              <div className="form-group">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <label htmlFor="custom-name-input" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Custom Manifold Name:
                  </label>
                  <HelpTooltip content="Unique identifier for your custom compiled manifold (e.g. SuperResMaster, AnimeDiffusion, FaceRestorationPro)." />
                </div>
                <input
                  id="custom-name-input"
                  type="text"
                  className="editor-input"
                  placeholder="e.g. SuperResMaster"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  disabled={isCustomCompiling}
                />
              </div>

              <div className="form-group">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <label htmlFor="custom-task-select" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Domain Task:
                  </label>
                  <HelpTooltip content="Machine learning target domain for schema and vetting policies." />
                </div>
                <select
                  id="custom-task-select"
                  className="editor-select"
                  value={customTask}
                  onChange={(e) => setCustomTask(e.target.value)}
                  disabled={isCustomCompiling}
                >
                  <option value="restoration">Restoration (Super-Resolution, Denoising, Deblurring)</option>
                  <option value="detection">Object Detection &amp; Bounding Boxes</option>
                  <option value="segmentation">Instance &amp; Semantic Segmentation</option>
                  <option value="quality">Aesthetic &amp; Quality Scoring</option>
                  <option value="vision">General Computer Vision</option>
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <label htmlFor="custom-format-select" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Container Architecture:
                  </label>
                  <HelpTooltip content="Storage container format: WebDataset (.tar shards), Parquet, MosaicML (.mds), or LitData." />
                </div>
                <select
                  id="custom-format-select"
                  className="editor-select"
                  value={customCanonicalFormat}
                  onChange={(e) => setCustomCanonicalFormat(e.target.value as "webdataset" | "parquet" | "mds" | "litdata")}
                  disabled={isCustomCompiling}
                >
                  <option value="webdataset">WebDataset Streaming (.tar shards)</option>
                  <option value="parquet">Columnar Parquet (.parquet)</option>
                  <option value="mds">MosaicML Streaming (.mds shards)</option>
                  <option value="litdata">PyTorch Lightning LitData (.bin)</option>
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <label htmlFor="custom-preset-select" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Compression Preset:
                  </label>
                  <HelpTooltip content="Predefined compression profile for image encoding and quality bounds." />
                </div>
                <select
                  id="custom-preset-select"
                  className="editor-select"
                  value={customPreset}
                  onChange={(e) => setCustomPreset(e.target.value)}
                  disabled={isCustomCompiling}
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <label htmlFor="custom-shard-size" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Samples Per Shard:
                  </label>
                  <HelpTooltip content="Target samples packed per container chunk." />
                </div>
                <input
                  id="custom-shard-size"
                  type="number"
                  className="editor-input"
                  value={customShardSize}
                  onChange={(e) => setCustomShardSize(Number(e.target.value))}
                  disabled={isCustomCompiling}
                  min={100}
                  max={50000}
                />
              </div>

              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "24px" }}>
                <input
                  id="custom-purge-check"
                  type="checkbox"
                  checked={customPurgeLoose}
                  onChange={(e) => setCustomPurgeLoose(e.target.checked)}
                  disabled={isCustomCompiling}
                />
                <label htmlFor="custom-purge-check" style={{ fontSize: "13px", color: "var(--text-primary)", cursor: "pointer" }}>
                  Purge loose source images post-compilation
                </label>
              </div>
            </div>

            {/* Multi-Source Input Textarea */}
            <div className="form-group" style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <label htmlFor="custom-sources-area" style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>
                    Source Repositories &amp; Dataset URLs (One per line):
                  </label>
                  <HelpTooltip content="Supports Kaggle (kaggle://slug or https://kaggle.com/datasets/...), HuggingFace (hf://repo or https://huggingface.co/datasets/...), Google Drive (gd://id or link), and GitHub (gh://repo or git link)." />
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Prefixes: kaggle:// | hf:// | gd:// | gh:// or raw URLs
                </span>
              </div>
              <textarea
                id="custom-sources-area"
                className="editor-textarea"
                rows={5}
                placeholder={"# Enter source repositories or direct links, one per line:\nkaggle://username/dataset-slug\nhttps://huggingface.co/datasets/org/dataset-name\nhttps://github.com/owner/repository\ngd://1A2b3C4d5E6F_google_drive_folder_id"}
                value={customSourcesText}
                onChange={(e) => setCustomSourcesText(e.target.value)}
                disabled={isCustomCompiling}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCustomCompile}
                disabled={isCustomCompiling || !datasetCompilerOnline}
              >
                {isCustomCompiling ? "Compiling Custom Manifold..." : "Compile Custom Dataset"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={loadCompilerData}
                disabled={isCustomCompiling || isRefreshing}
              >
                {isRefreshing ? "Refreshing Catalog..." : "Refresh Catalog"}
              </button>
            </div>

            {customCompileStatus && (
              <div
                className={`validation-banner ${customCompileStatus.includes("failed") ? "banner-error" : "banner-success"}`}
                style={{ marginTop: "16px" }}
                role="status"
              >
                <span>{customCompileStatus}</span>
              </div>
            )}
          </div>
        )}

        {!datasetCompilerOnline && (
          <div className="validation-banner banner-error" style={{ marginTop: "12px" }} role="alert">
            <span>Dataset Compiler Sidecar (Port 8100) is offline. Launch lemgendary-datasets to enable compilation.</span>
          </div>
        )}

        {refreshFeedback && (
          <div className="validation-banner banner-info" style={{ marginTop: "12px" }} role="status">
            <span>{refreshFeedback}</span>
          </div>
        )}
      </div>

      {/* ─── SECTION 2: KAGGLE CLOUD SYNCHRONIZATION & STORAGE HUB ───────── */}
      <div className="card" style={{ marginTop: "20px" }}>
        <div className="card-title">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600 }}>Kaggle Cloud Synchronization &amp; Storage Hub</h3>
            <HelpTooltip content="Bidirectional cloud synchronization with Kaggle Datasets Hub. Pull official registry manifolds defined in unified_data.yaml, download custom datasets via direct links, or publish local compiled manifolds to Kaggle." />
          </div>
          <div>
            {kaggleStatus?.authenticated ? (
              <span className="badge badge-success">Kaggle Authenticated</span>
            ) : (
              <span className="badge badge-warning">Kaggle Credentials Required</span>
            )}
          </div>
        </div>

        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
          Synchronize production datasets with Kaggle Cloud Storage. Download pre-compiled streaming
          manifolds or upload local models directly using official Kaggle API integration.
        </p>

        {/* Subtabs: Download vs Upload vs Update Metadata */}
        <div className="subtab-nav">
          <button
            type="button"
            className={`subtab-btn ${kaggleActiveTab === "download" ? "active" : ""}`}
            onClick={() => setKaggleActiveTab("download")}
          >
            Download from Kaggle
          </button>
          <button
            type="button"
            className={`subtab-btn ${kaggleActiveTab === "upload" ? "active" : ""}`}
            onClick={() => setKaggleActiveTab("upload")}
          >
            Upload to Kaggle
          </button>
          <button
            type="button"
            className={`subtab-btn ${kaggleActiveTab === "metadata" ? "active" : ""}`}
            onClick={() => setKaggleActiveTab("metadata")}
          >
            Update Metadata Only
          </button>
        </div>

        {/* Download Section */}
        {kaggleActiveTab === "download" && (
          <div>
            <div style={{ marginBottom: "16px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "8px", fontWeight: 500 }}>
                Download Source Mode:
              </span>
              <div className="segmented-control" style={{ maxWidth: "420px" }}>
                <button
                  type="button"
                  className={`segmented-btn ${kaggleDownloadMode === "registry" ? "active" : ""}`}
                  onClick={() => setKaggleDownloadMode("registry")}
                >
                  Registry Datasets (unified_data.yaml)
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${kaggleDownloadMode === "custom" ? "active" : ""}`}
                  onClick={() => setKaggleDownloadMode("custom")}
                >
                  Custom Kaggle Link / Slug
                </button>
              </div>
            </div>

            <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "16px" }}>
              {kaggleDownloadMode === "registry" ? (
                <div className="form-group" style={{ gridColumn: "span 2" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    <label htmlFor="kaggle-reg-select" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Select Registry Dataset:
                    </label>
                    <HelpTooltip content="Production datasets defined in unified_data.yaml with official Kaggle repository bindings." />
                  </div>
                  <select
                    id="kaggle-reg-select"
                    className="editor-select"
                    value={selectedRegistryKey}
                    onChange={(e) => setSelectedRegistryKey(e.target.value)}
                    disabled={isDownloadingKaggle}
                  >
                    {kaggleRegistry.map((reg) => (
                      <option key={reg.key} value={reg.key}>
                        {reg.title} [{reg.clean_repo_id}] {reg.is_local_present ? "- (Present Locally)" : "- (Not Downloaded)"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="form-group" style={{ gridColumn: "span 2" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    <label htmlFor="kaggle-custom-ref" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Kaggle Dataset Link or Slug:
                    </label>
                    <HelpTooltip content="Paste direct Kaggle URL (e.g. https://www.kaggle.com/datasets/username/dataset-name) or repository slug (username/dataset-name)." />
                  </div>
                  <input
                    id="kaggle-custom-ref"
                    type="text"
                    className="editor-input"
                    placeholder="e.g. https://www.kaggle.com/datasets/lemgenda/lemgendized-upn-v2 or owner/dataset"
                    value={customKaggleRef}
                    onChange={(e) => setCustomKaggleRef(e.target.value)}
                    disabled={isDownloadingKaggle}
                  />
                </div>
              )}

              <div className="form-group">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <label htmlFor="download-dest-folder" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Target Folder Name (Optional):
                  </label>
                  <HelpTooltip content="Destination subfolder inside LemGendaryDatasets. Defaults to manifold name." />
                </div>
                <input
                  id="download-dest-folder"
                  type="text"
                  className="editor-input"
                  placeholder="Defaults to LemGendized folder name"
                  value={downloadTargetFolder}
                  onChange={(e) => setDownloadTargetFolder(e.target.value)}
                  disabled={isDownloadingKaggle}
                />
              </div>

              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "24px" }}>
                <input
                  id="download-force-check"
                  type="checkbox"
                  checked={downloadForce}
                  onChange={(e) => setDownloadForce(e.target.checked)}
                  disabled={isDownloadingKaggle}
                />
                <label htmlFor="download-force-check" style={{ fontSize: "13px", color: "var(--text-primary)", cursor: "pointer" }}>
                  Force redownload / overwrite existing files
                </label>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleKaggleDownload}
                disabled={isDownloadingKaggle || !datasetCompilerOnline}
              >
                {isDownloadingKaggle ? "Initiating Download..." : "Download from Kaggle"}
              </button>
            </div>

            {downloadStatus && (
              <div
                className={`validation-banner ${downloadStatus.includes("failed") ? "banner-error" : "banner-success"}`}
                style={{ marginTop: "16px" }}
                role="status"
              >
                <span>{downloadStatus}</span>
              </div>
            )}
          </div>
        )}

        {/* Upload Section */}
        {kaggleActiveTab === "upload" && (
          <div>
            <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "16px" }}>
              <div className="form-group">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <label htmlFor="upload-manifold-select" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Local Compiled Manifold:
                  </label>
                  <HelpTooltip content="Select the local compiled dataset to package and upload to Kaggle." />
                </div>
                <select
                  id="upload-manifold-select"
                  className="editor-select"
                  value={uploadManifold}
                  onChange={(e) => setUploadManifold(e.target.value)}
                  disabled={isUploadingKaggle}
                >
                  {datasets.map((d) => (
                    <option key={d.key} value={d.modernized_folder || d.key}>
                      {d.display_name} ({d.modernized_folder || d.key})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <label htmlFor="upload-kaggle-slug" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Target Kaggle Repository Slug (Optional):
                  </label>
                  <HelpTooltip content="Kaggle repository identifier (e.g. owner/dataset-slug). If left blank, looked up from unified_data.yaml." />
                </div>
                <input
                  id="upload-kaggle-slug"
                  type="text"
                  className="editor-input"
                  placeholder="e.g. lemgenda/lemgendized-upn-v2 (or auto from registry)"
                  value={uploadKaggleRef}
                  onChange={(e) => setUploadKaggleRef(e.target.value)}
                  disabled={isUploadingKaggle}
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleKaggleUpload}
                disabled={isUploadingKaggle || !datasetCompilerOnline}
              >
                {isUploadingKaggle ? "Initiating Upload..." : "Upload to Kaggle"}
              </button>
            </div>

            {uploadStatus && (
              <div
                className={`validation-banner ${uploadStatus.includes("failed") ? "banner-error" : "banner-success"}`}
                style={{ marginTop: "16px" }}
                role="status"
              >
                <span>{uploadStatus}</span>
              </div>
            )}
          </div>
        )}

        {/* Metadata Update Section */}
        {kaggleActiveTab === "metadata" && (
          <div>
            <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "16px" }}>
              <div className="form-group" style={{ gridColumn: "span 2" }}>
                <div className="segmented-control" style={{ maxWidth: "480px", marginBottom: "16px" }}>
                  <button
                    type="button"
                    className={`segmented-btn ${metaUpdateMode === "single" ? "active" : ""}`}
                    onClick={() => setMetaUpdateMode("single")}
                    disabled={isUpdatingMeta}
                  >
                    Single Dataset
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${metaUpdateMode === "all" ? "active" : ""}`}
                    onClick={() => setMetaUpdateMode("all")}
                    disabled={isUpdatingMeta}
                  >
                    All Datasets (unified_data.yaml)
                  </button>
                </div>
              </div>

              {metaUpdateMode === "single" && (
                <>
                  <div className="form-group">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                      <label htmlFor="meta-manifold-select" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        Local Manifold:
                      </label>
                      <HelpTooltip content="Select the manifold whose dataset-metadata.json will be pushed to Kaggle." />
                    </div>
                    <select
                      id="meta-manifold-select"
                      className="editor-select"
                      value={metaUpdateManifold}
                      onChange={(e) => setMetaUpdateManifold(e.target.value)}
                      disabled={isUpdatingMeta}
                    >
                      {datasets.map((d) => (
                        <option key={d.key} value={d.modernized_folder || d.key}>
                          {d.display_name} ({d.modernized_folder || d.key})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                      <label htmlFor="meta-kaggle-ref" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        Kaggle Repository Slug (Optional):
                      </label>
                      <HelpTooltip content="Leave blank to auto-resolve from unified_data.yaml. Format: owner/dataset-slug" />
                    </div>
                    <input
                      id="meta-kaggle-ref"
                      type="text"
                      className="editor-input"
                      placeholder="e.g. lemgenda/lemgendized-upn-v2 (or auto from registry)"
                      value={metaUpdateRef}
                      onChange={(e) => setMetaUpdateRef(e.target.value)}
                      disabled={isUpdatingMeta}
                    />
                  </div>
                </>
              )}

              {metaUpdateMode === "all" && (
                <div className="form-group" style={{ gridColumn: "span 2" }}>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                    Updates Kaggle metadata (title, description, license, column descriptors) for
                    <strong> every dataset</strong> in <code>unified_data.yaml</code> that has a local
                    <code> dataset-metadata.json</code>. No data is re-uploaded.
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleKaggleMetadataUpdate}
                disabled={isUpdatingMeta || !datasetCompilerOnline}
              >
                {isUpdatingMeta ? "Initiating Metadata Update..." : "Update Metadata on Kaggle"}
              </button>
            </div>

            {metaUpdateStatus && (
              <div
                className={`validation-banner ${metaUpdateStatus.includes("failed") ? "banner-error" : "banner-success"}`}
                style={{ marginTop: "16px" }}
                role="status"
              >
                <span>{metaUpdateStatus}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── SECTION 3: PRODUCTION MANIFOLDS CATALOG ───────────────────────── */}
      <div style={{ marginTop: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h4 style={{ fontSize: "15px", fontWeight: 600 }}>
            Production Manifolds Catalog &amp; Format Breakdown ({datasets.length} Datasets)
          </h4>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            All manifolds verified in local storage root
          </span>
        </div>

        <div className="card-grid">
          {datasets.map((d) => (
            <div key={d.key} className="card">
              <div className="card-title">
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <h5 style={{ fontSize: "14px", fontWeight: 600 }}>{d.display_name}</h5>
                  <HelpTooltip content={`Detailed format distribution for manifold '${d.key}'. Canonical target: ${d.canonical_format || d.format}.`} />
                </div>
                <span className={`badge ${d.is_compiled ? "badge-success" : "badge-warning"}`}>
                  {d.is_compiled ? "COMPILED" : "UNCOMPILED"}
                </span>
              </div>

              <div className="metric-row">
                <span className="metric-label">Format / Architecture</span>
                <span className="metric-value">{d.canonical_format || d.format}</span>
              </div>

              <div className="metric-row">
                <span className="metric-label">Total Samples</span>
                <span className="metric-value">{d.total_samples.toLocaleString()}</span>
              </div>

              <div className="metric-row">
                <span className="metric-label">Disk Footprint</span>
                <span className="metric-value">{Math.round(d.total_size_mb / 1024 * 10) / 10} GB</span>
              </div>

              <div className="metric-row">
                <span className="metric-label">Container Shards</span>
                <span className="metric-value">{d.shards_count || 0} shards</span>
              </div>

              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                <span>WebP: {d.format_breakdown.webp.toLocaleString()}</span>
                <span>JPG: {d.format_breakdown.jpg.toLocaleString()}</span>
                <span>PNG: {d.format_breakdown.png.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CompilerPanel;
