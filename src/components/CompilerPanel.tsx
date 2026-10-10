import React, { useState, useEffect, useCallback, useMemo } from "react";
import { HelpTooltip } from "./HelpTooltip";
import {
  fetchDatasets,
  fetchCompilerPresets,
  triggerQuickCompile,
  triggerCustomCompile,
  downloadKaggleDataset,
  uploadKaggleDataset,
  updateKaggleMetadata,
} from "../api/client";
import {
  CompilerPreset,
  DatasetItem,
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

  // Search & Filter State for Manifolds Catalog (matching Model Matrix)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [formatFilter, setFormatFilter] = useState<string>("ALL");
  const [taskFilter, setTaskFilter] = useState<string>("ALL");

  // Pinned/hovered Upstream Sources details (matching SOTA targets row on models)
  const [pinnedSourcesManifold, setPinnedSourcesManifold] = useState<string | null>(null);
  const [hoveredSourcesManifold, setHoveredSourcesManifold] = useState<string | null>(null);

  // Custom Kaggle Link / Slug Download Bar state
  const [customKaggleRef, setCustomKaggleRef] = useState<string>("");
  const [downloadTargetFolder, setDownloadTargetFolder] = useState<string>("");
  const [downloadForce, setDownloadForce] = useState<boolean>(false);
  const [isDownloadingKaggle, setIsDownloadingKaggle] = useState<boolean>(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  // Card-level action busy states & status notices
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadCompilerData = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshFeedback(null);
    try {
      const [dsList, prList] = await Promise.all([
        fetchDatasets(),
        fetchCompilerPresets(),
      ]);

      if (dsList.length > 0) {
        setDatasets(dsList);
        setSelectedManifold((prev) => prev || dsList[0].key);
        setRefreshFeedback(`Catalog refreshed: ${dsList.length} production manifolds loaded.`);
      } else {
        // Fallback default manifolds from unified_data.yaml with full sources & splits
        const fallbackDatasets: DatasetItem[] = [
          {
            key: "upn_v2",
            display_name: "Unified Perceptual Net V2",
            format: "webdataset",
            canonical_format: "webdataset",
            total_samples: 1378070,
            total_size_mb: 53600,
            format_breakdown: { webp: 1378070, jpg: 0, png: 0, parquet: 0, other: 0 },
            shards_count: 285,
            is_compiled: true,
            task: "restoration",
            modernized_folder: "LemGendizedUpnV2",
            kaggle_ref: "kaggle://lemtreursi/lemgendizedupnv2",
            sources: [
              { name: "DPED", count: 344517, type: "SOURCE" },
              { name: "Adobe FiveK", count: 344517, type: "SOURCE" },
              { name: "DIV2K", count: 344517, type: "KAGGLE" },
              { name: "Flickr2K", count: 344519, type: "KAGGLE" },
            ],
          },
          {
            key: "mirnet_exposure",
            display_name: "MIRNet Low-Light & Exposure",
            format: "webdataset",
            canonical_format: "webdataset",
            total_samples: 1416459,
            total_size_mb: 87840,
            format_breakdown: { webp: 1416459, jpg: 0, png: 0, parquet: 0, other: 0 },
            shards_count: 283,
            is_compiled: true,
            task: "restoration",
            modernized_folder: "LemGendizedMirNetExposure",
            kaggle_ref: "kaggle://lemtreursi/lemgendizedmirnetexposure",
            sources: [
              { name: "SICE Dataset", count: 850000, type: "SOURCE" },
              { name: "Exposure Correction", count: 566459, type: "KAGGLE" },
            ],
          },
          {
            key: "nima_aesthetic",
            display_name: "NIMA Perceptual Aesthetics",
            format: "parquet",
            canonical_format: "parquet",
            total_samples: 321369,
            total_size_mb: 18200,
            format_breakdown: { webp: 321369, jpg: 0, png: 0, parquet: 65, other: 0 },
            shards_count: 65,
            is_compiled: true,
            task: "quality",
            modernized_folder: "LemGendizedNimaAesthetic",
            kaggle_ref: "kaggle://lemtreursi/lemgendizednimaaesthetic",
            sources: [
              { name: "AVA Benchmark", count: 255500, type: "KAGGLE" },
              { name: "TAD66K", count: 45000, type: "HUGGINGFACE" },
              { name: "SPAQ", count: 11125, type: "HUGGINGFACE" },
              { name: "KonIQ-10k", count: 9744, type: "KAGGLE" },
            ],
          },
          {
            key: "professional_multitask_restoration",
            display_name: "Multitask Restoration Pro",
            format: "mds",
            canonical_format: "mds",
            total_samples: 343911,
            total_size_mb: 45200,
            format_breakdown: { webp: 343911, jpg: 0, png: 0, parquet: 0, other: 0 },
            shards_count: 85,
            is_compiled: true,
            task: "restoration",
            modernized_folder: "LemGendizedMultitaskRestorationPro",
            kaggle_ref: "kaggle://lemtreursi/lemgendizedmultitaskrestorationpro",
            sources: [
              { name: "NAFNet Deblurring", count: 31264, type: "SUB-MANIFOLD" },
              { name: "NAFNet Denoising", count: 31264, type: "SUB-MANIFOLD" },
              { name: "MPRNet Deraining", count: 31264, type: "SUB-MANIFOLD" },
              { name: "FFANet Indoor", count: 31264, type: "SUB-MANIFOLD" },
              { name: "FFANet Outdoor", count: 31264, type: "SUB-MANIFOLD" },
              { name: "MIRNet Low-Light", count: 31264, type: "SUB-MANIFOLD" },
              { name: "MIRNet Exposure", count: 31264, type: "SUB-MANIFOLD" },
              { name: "UltraZoom", count: 31264, type: "SUB-MANIFOLD" },
              { name: "Film Restorer", count: 31264, type: "SUB-MANIFOLD" },
              { name: "CodeFormer", count: 31264, type: "SUB-MANIFOLD" },
              { name: "ParseNet", count: 31271, type: "SUB-MANIFOLD" },
            ],
          },
          {
            key: "classification_master_manifold",
            display_name: "Classification Master Manifold",
            format: "mds",
            canonical_format: "mds",
            total_samples: 788034,
            total_size_mb: 61800,
            format_breakdown: { webp: 788034, jpg: 0, png: 0, parquet: 0, other: 0 },
            shards_count: 136,
            is_compiled: true,
            task: "classification",
            modernized_folder: "LemGendizedClassificationMaster",
            kaggle_ref: "kaggle://lemtreursi/lemgendizedclassificationmaster",
            sources: [
              { name: "Anime DB Rating (Danbooru)", count: 262678, type: "HUGGINGFACE" },
              { name: "General NSFW", count: 262678, type: "HUGGINGFACE" },
              { name: "Food-101 Baseline", count: 262678, type: "HUGGINGFACE" },
            ],
          },
          {
            key: "yolov8n",
            display_name: "YOLOv8n Detection & Segmentation",
            format: "directory",
            canonical_format: "directory",
            total_samples: 153972,
            total_size_mb: 12400,
            format_breakdown: { webp: 0, jpg: 135659, png: 18313, parquet: 0, other: 0 },
            shards_count: 2,
            is_compiled: true,
            task: "detection",
            modernized_folder: "LemGendizedYoloV8n",
            kaggle_ref: "kaggle://lemtreursi/lemgendizedyolov8n",
            sources: [
              { name: "COCO 2017", count: 118287, type: "KAGGLE" },
              { name: "Pascal VOC 2012", count: 17125, type: "KAGGLE" },
              { name: "CrowdPose Dataset", count: 10000, type: "SOURCE" },
              { name: "KITTI Benchmark", count: 7481, type: "SOURCE" },
              { name: "MPII Human Pose", count: 1079, type: "SOURCE" },
            ],
          },
          {
            key: "film_restorer",
            display_name: "Film Restorer & Scratch Removal",
            format: "webdataset",
            canonical_format: "webdataset",
            total_samples: 67542,
            total_size_mb: 28500,
            format_breakdown: { webp: 67542, jpg: 0, png: 0, parquet: 0, other: 0 },
            shards_count: 14,
            is_compiled: true,
            task: "restoration",
            modernized_folder: "LemGendizedFilmRestorer",
            kaggle_ref: "kaggle://lemtreursi/lemgendizedfilmrestorer",
            sources: [
              { name: "Old Film Restoration", count: 28000, type: "KAGGLE" },
              { name: "Vintage Photos", count: 22542, type: "KAGGLE" },
              { name: "Bringing-Old-Photos-Back-to-Life", count: 17000, type: "HUGGINGFACE" },
            ],
          },
        ];
        setDatasets(fallbackDatasets);
        setSelectedManifold((prev) => prev || "upn_v2");
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
    } catch {
      setRefreshFeedback("Failed to query Dataset Compiler Sidecar (Port 8100).");
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshFeedback(null), 4000);
    }
  }, [datasetCompilerOnline]);

  useEffect(() => {
    loadCompilerData();
  }, [loadCompilerData]);

  // Standard Compile Handler
  const handleCompile = async () => {
    if (!datasetCompilerOnline) {
      setCompileStatus("Compilation failed: Dataset Compiler Sidecar (Port 8100) is not reachable.");
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
      setCompileStatus(`Compilation initiated successfully (Job ID: ${res.job_id || "Active"}). Telemetry streaming to monitor below.`);
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

  // Custom Kaggle Slug Download Handler
  const handleCustomKaggleDownload = async () => {
    if (!datasetCompilerOnline) {
      setDownloadStatus("Kaggle download failed: Dataset Compiler Sidecar (Port 8100) is offline.");
      return;
    }
    const targetRef = customKaggleRef.trim();
    if (!targetRef) {
      setDownloadStatus("Please enter a Kaggle dataset link or repository slug (e.g. owner/dataset).");
      return;
    }

    setIsDownloadingKaggle(true);
    setDownloadStatus(null);
    try {
      const res = await downloadKaggleDataset({
        kaggle_ref: targetRef,
        target_folder: downloadTargetFolder.trim() || undefined,
        force: downloadForce,
      });
      setDownloadStatus(`Kaggle download initiated for ${targetRef} (Job ID: ${res.job_id || "Active"}). Streaming to disk.`);
      loadCompilerData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setDownloadStatus(`Download failed: ${msg}`);
    } finally {
      setIsDownloadingKaggle(false);
    }
  };

  // Per-Dataset Card Actions
  const handleDownloadManifold = async (dataset: DatasetItem) => {
    if (!datasetCompilerOnline) {
      setActionNotice("Download failed: Dataset Compiler Sidecar (Port 8100) is offline.");
      return;
    }
    const ref = dataset.kaggle_ref || dataset.key;
    const folder = dataset.modernized_folder || dataset.key;
    setActionBusyKey(`dl_${dataset.key}`);
    setActionNotice(null);
    try {
      const res = await downloadKaggleDataset({
        kaggle_ref: ref,
        target_folder: folder,
        force: false,
      });
      setActionNotice(`Kaggle download initiated for ${dataset.display_name} (Job ID: ${res.job_id || "Active"}).`);
      loadCompilerData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setActionNotice(`Download failed for ${dataset.display_name}: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleUploadManifold = async (dataset: DatasetItem) => {
    if (!datasetCompilerOnline) {
      setActionNotice("Upload failed: Dataset Compiler Sidecar (Port 8100) is offline.");
      return;
    }
    const manifoldFolder = dataset.modernized_folder || dataset.key;
    setActionBusyKey(`ul_${dataset.key}`);
    setActionNotice(`Packaging and uploading ${dataset.display_name} to Kaggle Cloud...`);
    try {
      const res = await uploadKaggleDataset({
        manifold: manifoldFolder,
        kaggle_ref: dataset.kaggle_ref || undefined,
      });
      setActionNotice(`Kaggle upload initiated for ${dataset.display_name} (Job ID: ${res.job_id || "Active"}).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setActionNotice(`Upload failed for ${dataset.display_name}: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleUpdateMetadataSingle = async (dataset: DatasetItem) => {
    if (!datasetCompilerOnline) {
      setActionNotice("Metadata update failed: Dataset Compiler Sidecar (Port 8100) is offline.");
      return;
    }
    const manifoldFolder = dataset.modernized_folder || dataset.key;
    setActionBusyKey(`meta_${dataset.key}`);
    setActionNotice(null);
    try {
      const res = await updateKaggleMetadata({
        manifold: manifoldFolder,
        kaggle_ref: dataset.kaggle_ref || undefined,
      });
      setActionNotice(`Pushed dataset-metadata.json descriptors to Kaggle for ${dataset.display_name} (Job ID: ${res.job_id || "Active"}).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setActionNotice(`Metadata update failed for ${dataset.display_name}: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  // Distinct tasks & formats for filtering
  const uniqueFormats = useMemo(() => {
    const set = new Set<string>();
    datasets.forEach((d) => {
      const f = d.canonical_format || d.format;
      if (f) set.add(f.toLowerCase());
    });
    return Array.from(set).sort();
  }, [datasets]);

  const uniqueTasks = useMemo(() => {
    const set = new Set<string>();
    datasets.forEach((d) => {
      if (d.task) set.add(d.task.toLowerCase());
    });
    return Array.from(set).sort();
  }, [datasets]);

  // Filtered datasets
  const filteredDatasets = useMemo(() => {
    return datasets.filter((d) => {
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = d.display_name.toLowerCase().includes(q);
        const matchesKey = d.key.toLowerCase().includes(q);
        const matchesFormat = (d.canonical_format || d.format || "").toLowerCase().includes(q);
        const matchesTask = (d.task || "").toLowerCase().includes(q);
        if (!matchesName && !matchesKey && !matchesFormat && !matchesTask) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "ALL") {
        if (statusFilter === "COMPILED" && !d.is_compiled) return false;
        if (statusFilter === "UNCOMPILED" && d.is_compiled) return false;
      }

      // Format filter
      if (formatFilter !== "ALL") {
        const f = (d.canonical_format || d.format || "").toLowerCase();
        if (f !== formatFilter.toLowerCase()) return false;
      }

      // Task filter
      if (taskFilter !== "ALL") {
        const t = (d.task || "").toLowerCase();
        if (t !== taskFilter.toLowerCase()) return false;
      }

      return true;
    });
  }, [datasets, searchQuery, statusFilter, formatFilter, taskFilter]);

  const toggleSourcesPin = (datasetKey: string) => {
    setPinnedSourcesManifold((prev) => (prev === datasetKey ? null : datasetKey));
  };

  return (
    <div className="panel-container">
      {/* ─── SECTION 1: DATASET COMPILER & STORAGE MODERNIZATION ────────────── */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div className="card-title" style={{ marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              Dataset Compiler &amp; Storage Modernization
            </h3>
            <HelpTooltip content="Autonomous dataset synthesis engine. Compiles raw multi-source image collections into modern streaming containers (WebDataset .tar, Parquet, MDS, LitData)." />
          </div>
          <span className="badge badge-info" style={{ fontSize: "11px" }}>Port 8100 Sidecar</span>
        </div>

        <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 12px 0", lineHeight: 1.4 }}>
          Modernize raw archives into streaming containers with in-flight 12-thread WebP transcoding,
          automatic directory flattening, aspect-ratio quantization, and zero NTFS block overhead.
        </p>

        <div style={{ marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="segmented-control" style={{ maxWidth: "440px" }}>
              <button
                type="button"
                className={`segmented-btn ${compileMode === "standard" ? "active" : ""}`}
                onClick={() => setCompileMode("standard")}
                style={{ fontSize: "12px", padding: "4px 12px" }}
              >
                Standard Manifold Compilation
              </button>
              <button
                type="button"
                className={`segmented-btn ${compileMode === "custom" ? "active" : ""}`}
                onClick={() => setCompileMode("custom")}
                style={{ fontSize: "12px", padding: "4px 12px" }}
              >
                Custom Multi-Source Compilation
              </button>
            </div>
            <HelpTooltip content="Standard Manifold Compilation compiles datasets registered in unified_data.yaml. Custom Multi-Source Compilation ingests from Kaggle, HuggingFace, Google Drive, or GitHub into a new named manifold." />
          </div>
        </div>

        {/* Standard Mode Form */}
        {compileMode === "standard" && (
          <div>
            <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px", marginBottom: "14px" }}>
              <div className="form-group">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <label htmlFor="manifold-select" style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
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
                  style={{ fontSize: "12px", padding: "6px 8px" }}
                >
                  {datasets.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.display_name} [{d.canonical_format || d.format}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <label htmlFor="preset-select" style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                    Storage Format Preset:
                  </label>
                  <HelpTooltip content="Canonical storage architecture: WebDataset for sequential streaming, Parquet for metadata tables, MDS for fast random access, or LitData for tensor storage." />
                </div>
                <select
                  id="preset-select"
                  className="editor-select"
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  disabled={isCompiling}
                  style={{ fontSize: "12px", padding: "6px 8px" }}
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <label htmlFor="shard-size-input" style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                    Samples Per Shard:
                  </label>
                  <HelpTooltip content="Number of paired input/target samples serialized per container chunk. 5,000 samples typically produces 300-400MB shards, optimal for web streaming." />
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
                  style={{ fontSize: "12px", padding: "6px 8px" }}
                />
              </div>

              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "22px" }}>
                <input
                  id="purge-loose-check"
                  type="checkbox"
                  checked={purgeLooseImages}
                  onChange={(e) => setPurgeLooseImages(e.target.checked)}
                  disabled={isCompiling}
                />
                <label htmlFor="purge-loose-check" style={{ fontSize: "12px", color: "var(--text-primary)", cursor: "pointer", userSelect: "none" }}>
                  Purge loose images post-compilation
                </label>
                <HelpTooltip content="When enabled, deletes redundant uncompressed loose image files after writing shards to eliminate dual-storage disk amplification." />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCompile}
                disabled={isCompiling || !datasetCompilerOnline}
                style={{ fontSize: "12px", padding: "6px 14px", fontWeight: 600 }}
                aria-label={!datasetCompilerOnline ? "Compile unavailable: Dataset Compiler Sidecar offline" : "Start dataset manifold compilation"}
              >
                {isCompiling ? "Compiling Manifold..." : "Compile Manifold"}
              </button>
              <HelpTooltip content="Launch multi-threaded compilation. Transcodes samples to lossless WebP, builds container indexes, and purges redundant loose images." />
            </div>

            {compileStatus && (
              <div
                className={`validation-banner ${compileStatus.includes("failed") ? "banner-error" : "banner-success"}`}
                style={{ marginTop: "12px", fontSize: "12px" }}
                role="status"
              >
                <span>{compileStatus}</span>
              </div>
            )}
          </div>
        )}

        {/* Custom Mode Form */}
        {compileMode === "custom" && (
          <div>
            <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "14px" }}>
              <div className="form-group">
                <label htmlFor="custom-name-input" style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Manifold Name:
                </label>
                <input
                  id="custom-name-input"
                  type="text"
                  className="editor-input"
                  placeholder="e.g. FineArtPortraitsV1"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  disabled={isCustomCompiling}
                  style={{ fontSize: "12px", padding: "6px 8px" }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="custom-task-select" style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Task Category:
                </label>
                <select
                  id="custom-task-select"
                  className="editor-select"
                  value={customTask}
                  onChange={(e) => setCustomTask(e.target.value)}
                  disabled={isCustomCompiling}
                  style={{ fontSize: "12px", padding: "6px 8px" }}
                >
                  <option value="restoration">Restoration &amp; Enhancement</option>
                  <option value="detection">Detection &amp; Localization</option>
                  <option value="classification">Classification &amp; Filtering</option>
                  <option value="quality">Aesthetic &amp; Quality Scoring</option>
                  <option value="vision">General Computer Vision</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="custom-format-select" style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Container Format:
                </label>
                <select
                  id="custom-format-select"
                  className="editor-select"
                  value={customCanonicalFormat}
                  onChange={(e) => setCustomCanonicalFormat(e.target.value as "webdataset" | "parquet" | "mds" | "litdata")}
                  disabled={isCustomCompiling}
                  style={{ fontSize: "12px", padding: "6px 8px" }}
                >
                  <option value="webdataset">WebDataset Streaming (.tar shards)</option>
                  <option value="parquet">Columnar Parquet (.parquet)</option>
                  <option value="mds">MosaicML Streaming (.mds shards)</option>
                  <option value="litdata">PyTorch Lightning LitData (.bin)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="custom-preset-select" style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Compression Profile:
                </label>
                <select
                  id="custom-preset-select"
                  className="editor-select"
                  value={customPreset}
                  onChange={(e) => setCustomPreset(e.target.value)}
                  disabled={isCustomCompiling}
                  style={{ fontSize: "12px", padding: "6px 8px" }}
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="custom-shard-size" style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Samples Per Shard:
                </label>
                <input
                  id="custom-shard-size"
                  type="number"
                  className="editor-input"
                  value={customShardSize}
                  onChange={(e) => setCustomShardSize(Number(e.target.value))}
                  disabled={isCustomCompiling}
                  min={100}
                  max={50000}
                  style={{ fontSize: "12px", padding: "6px 8px" }}
                />
              </div>

              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "22px" }}>
                <input
                  id="custom-purge-check"
                  type="checkbox"
                  checked={customPurgeLoose}
                  onChange={(e) => setCustomPurgeLoose(e.target.checked)}
                  disabled={isCustomCompiling}
                />
                <label htmlFor="custom-purge-check" style={{ fontSize: "12px", color: "var(--text-primary)", cursor: "pointer", userSelect: "none" }}>
                  Purge loose source images
                </label>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <label htmlFor="custom-sources-area" style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                  Source Repositories &amp; URLs (One per line):
                </label>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Prefixes: kaggle:// | hf:// | gd:// | gh:// or raw URLs
                </span>
              </div>
              <textarea
                id="custom-sources-area"
                className="editor-textarea"
                rows={3}
                placeholder={"# Enter source repositories or direct links, one per line:\nkaggle://username/dataset-slug\nhttps://huggingface.co/datasets/org/dataset-name\nhttps://github.com/owner/repository"}
                value={customSourcesText}
                onChange={(e) => setCustomSourcesText(e.target.value)}
                disabled={isCustomCompiling}
                style={{ fontSize: "12px", padding: "8px" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCustomCompile}
                disabled={isCustomCompiling || !datasetCompilerOnline}
                style={{ fontSize: "12px", padding: "6px 14px", fontWeight: 600 }}
              >
                {isCustomCompiling ? "Compiling Custom Manifold..." : "Compile Custom Dataset"}
              </button>
            </div>

            {customCompileStatus && (
              <div
                className={`validation-banner ${customCompileStatus.includes("failed") ? "banner-error" : "banner-success"}`}
                style={{ marginTop: "12px", fontSize: "12px" }}
                role="status"
              >
                <span>{customCompileStatus}</span>
              </div>
            )}
          </div>
        )}

        {!datasetCompilerOnline && (
          <div className="validation-banner banner-error" style={{ marginTop: "12px", fontSize: "12px" }} role="alert">
            <span>Dataset Compiler Sidecar (Port 8100) is offline. Launch lemgendary-datasets to enable compilation.</span>
          </div>
        )}
      </div>

      {/* ─── SECTION 2: PRODUCTION MANIFOLDS CATALOG (REVAMPED UX & STYLING) ── */}
      <div className="card" style={{ marginTop: "20px", padding: "20px" }}>
        {/* Header & Controls Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                LemGendary Compiled Manifolds Repo
              </h3>
              <HelpTooltip content="Authoritative catalog of compiled dataset manifolds in LemGendary Compiled Manifolds Repo (./LemGendaryDatasets/). Features real-time shard validation, upstream source provenance tracking, direct Kaggle cloud bidirectional sync, and notebook audits." />
              <span className="badge badge-info" style={{ fontSize: "11px" }}>
                {filteredDatasets.length} of {datasets.length} Manifolds
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
              Modern streaming containers in ./LemGendaryDatasets/ with verified split telemetry, expandable source provenance, and integrated cloud synchronization.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadCompilerData}
              disabled={isRefreshing}
              style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              aria-label="Refresh datasets list and format breakdown from sidecar"
            >
              <span>{isRefreshing ? "Refreshing Catalog..." : "Refresh Catalog"}</span>
            </button>
            <HelpTooltip content="Poll Port 8100 sidecar to rescan storage roots, refresh container shard allocations, verify hardlink ratios, and audit metadata." />
          </div>
        </div>

        {/* Search & Filter Toolbar (Identical to Model Matrix) */}
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px", padding: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "8px", marginBottom: "16px" }}>
          {/* Live Search Input */}
          <div style={{ flex: "1 1 220px", position: "relative" }}>
            <input
              type="text"
              placeholder="Filter by manifold name, format, task category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="editor-input"
              style={{ width: "100%", padding: "6px 10px", fontSize: "12px" }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "12px" }}
              >
                X
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="editor-select"
              style={{ padding: "6px 8px", fontSize: "12px" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPILED">Compiled Only</option>
              <option value="UNCOMPILED">Uncompiled</option>
            </select>
          </div>

          {/* Format Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Format:</span>
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              className="editor-select"
              style={{ padding: "6px 8px", fontSize: "12px" }}
            >
              <option value="ALL">All Formats</option>
              {uniqueFormats.map((f) => (
                <option key={f} value={f}>{f.toUpperCase()}</option>
              ))}
            </select>
          </div>

          {/* Task Category Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Category:</span>
            <select
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
              className="editor-select"
              style={{ padding: "6px 8px", fontSize: "12px" }}
            >
              <option value="ALL">All Categories</option>
              {uniqueTasks.map((t) => (
                <option key={t} value={t}>{t.toUpperCase()}</option>
              ))}
            </select>
          </div>

          {(searchQuery || statusFilter !== "ALL" || formatFilter !== "ALL" || taskFilter !== "ALL") && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
                setFormatFilter("ALL");
                setTaskFilter("ALL");
              }}
              style={{ fontSize: "11px", padding: "4px 8px" }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Custom Kaggle Link / Slug Download Bar (Directly below headers, above individual manifold cards) */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", padding: "10px 14px", background: "rgba(59, 130, 246, 0.04)", border: "1px solid rgba(59, 130, 246, 0.25)", borderRadius: "8px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#60a5fa" }}>Custom Kaggle Download:</span>
            <HelpTooltip content="Download any Kaggle dataset directly into LemGendaryDatasets by providing its repository slug (owner/dataset-name) or direct link." />
          </div>

          <div style={{ flex: "1 1 240px" }}>
            <input
              type="text"
              placeholder="e.g. owner/dataset-slug or https://www.kaggle.com/datasets/..."
              value={customKaggleRef}
              onChange={(e) => setCustomKaggleRef(e.target.value)}
              className="editor-input"
              style={{ width: "100%", padding: "5px 10px", fontSize: "12px" }}
              disabled={isDownloadingKaggle}
            />
          </div>

          <div style={{ flex: "0 1 180px" }}>
            <input
              type="text"
              placeholder="Target Folder (Optional)"
              value={downloadTargetFolder}
              onChange={(e) => setDownloadTargetFolder(e.target.value)}
              className="editor-input"
              style={{ width: "100%", padding: "5px 10px", fontSize: "12px" }}
              disabled={isDownloadingKaggle}
            />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-secondary)", cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={downloadForce}
              onChange={(e) => setDownloadForce(e.target.checked)}
              disabled={isDownloadingKaggle}
            />
            Overwrite Existing
          </label>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCustomKaggleDownload}
            disabled={isDownloadingKaggle || !datasetCompilerOnline || !customKaggleRef.trim()}
            style={{ fontSize: "11px", padding: "5px 12px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>{isDownloadingKaggle ? "Downloading..." : "Download Slug"}</span>
          </button>
        </div>

        {/* Global Feedback Banners */}
        {refreshFeedback && (
          <div className="validation-banner banner-info" style={{ marginBottom: "16px", fontSize: "12px" }} role="status">
            <span>{refreshFeedback}</span>
          </div>
        )}

        {downloadStatus && (
          <div
            className={`validation-banner ${downloadStatus.includes("failed") ? "banner-error" : "banner-success"}`}
            style={{ marginBottom: "16px", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
            role="status"
          >
            <span>{downloadStatus}</span>
            <button type="button" onClick={() => setDownloadStatus(null)} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontWeight: 700 }}>X</button>
          </div>
        )}

        {actionNotice && (
          <div
            className={`validation-banner ${actionNotice.includes("failed") ? "banner-error" : "banner-success"}`}
            style={{ marginBottom: "16px", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
            role="status"
          >
            <span>{actionNotice}</span>
            <button type="button" onClick={() => setActionNotice(null)} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontWeight: 700 }}>X</button>
          </div>
        )}

        {/* ─── INDIVIDUAL MANIFOLD CARDS GRID ─────────────────────────────── */}
        <div className="card-grid card-grid-models">
          {filteredDatasets.map((d) => {
            const isSourcesOpen = pinnedSourcesManifold === d.key || hoveredSourcesManifold === d.key;
            const isBusy = actionBusyKey === `dl_${d.key}` || actionBusyKey === `ul_${d.key}` || actionBusyKey === `meta_${d.key}`;
            const isDirectoryFormat = d.canonical_format === "directory" || d.format === "directory";

            return (
              <div
                key={d.key}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "16px",
                }}
              >
                {/* 1. Manifold Name: Full-width at the very top */}
                <div style={{ width: "100%", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                  <h4 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-primary)", lineHeight: 1.3, flex: 1 }}>
                    {d.display_name}
                  </h4>
                  <HelpTooltip content={`Authoritative key: ${d.key}. Local directory: ${d.modernized_folder || d.key}. Canonical format: ${d.canonical_format || d.format}.`} />
                </div>

                {/* 2. Compilation Status / Format Badge: Full-width directly below name */}
                <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", background: "rgba(255,255,255,0.03)", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                    Manifold Status:
                  </span>
                  <div>
                    {d.is_compiled ? (
                      <span className="badge badge-success" style={{ fontWeight: 700 }}>COMPILED</span>
                    ) : (
                      <span className="badge badge-warning" style={{ fontWeight: 700 }}>UNCOMPILED</span>
                    )}
                  </div>
                </div>

                {/* 3. Metric Specs Rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
                  <div className="metric-row">
                    <span className="metric-label">Storage Format</span>
                    <span className="metric-value" style={{ textTransform: "uppercase", fontWeight: 600 }}>
                      {d.canonical_format || d.format}
                    </span>
                  </div>

                  <div className="metric-row">
                    <span className="metric-label">Total Samples</span>
                    <span className="metric-value">{d.total_samples.toLocaleString()}</span>
                  </div>

                  <div className="metric-row">
                    <span className="metric-label">Disk Footprint</span>
                    <span className="metric-value">{(d.total_size_mb / 1024).toFixed(1)} GB</span>
                  </div>

                  <div className="metric-row">
                    <span className="metric-label">
                      {isDirectoryFormat ? "Dataset Splits" : "Container Shards"}
                    </span>
                    <span className="metric-value" style={{ fontWeight: 600, color: (d.shards_count && d.shards_count > 0) ? "var(--accent-emerald)" : undefined }}>
                      {isDirectoryFormat
                        ? `${d.shards_count || 2} splits (train/val)`
                        : `${d.shards_count || 0} shards`}
                    </span>
                  </div>

                  {/* 4. Expandable Upstream Sources Row (matching SOTA targets row on models) */}
                  <div
                    style={{
                      background: isSourcesOpen ? "rgba(59, 130, 246, 0.08)" : "rgba(255,255,255,0.02)",
                      border: isSourcesOpen ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid var(--border-color)",
                      borderRadius: "6px",
                      padding: "8px 10px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onClick={() => toggleSourcesPin(d.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSourcesPin(d.key);
                      }
                    }}
                    onMouseEnter={() => setHoveredSourcesManifold(d.key)}
                    onMouseLeave={() => setHoveredSourcesManifold((prev) => (prev === d.key ? null : prev))}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isSourcesOpen}
                    aria-label={`Upstream sources for ${d.display_name}. Click to pin open.`}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>
                          Upstream Sources
                        </span>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                          {pinnedSourcesManifold === d.key ? "(Pinned)" : "(Click to pin)"}
                        </span>
                      </div>
                      <span
                        className="metric-value"
                        style={{
                          color: (d.sources && d.sources.length > 0) ? "var(--accent-emerald)" : "var(--text-muted)",
                          fontWeight: 700,
                          fontSize: "12px",
                        }}
                      >
                        {d.sources && d.sources.length > 0 ? `${d.sources.length} Sources` : "1 Primary Source"}
                      </span>
                    </div>

                    {/* Expanded Sources Details */}
                    {isSourcesOpen && d.sources && d.sources.length > 0 && (
                      <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {d.sources.map((s, idx) => (
                          <div key={`${s.name}_${idx}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" }}>
                            <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }} title={s.ref || s.name}>
                              {s.name}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                                {s.count ? `${s.count.toLocaleString()} samples` : "Active"}
                              </span>
                              <span className="badge badge-secondary" style={{ fontSize: "9px", padding: "1px 5px", textTransform: "uppercase" }}>
                                {s.type || "SOURCE"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 5. Format Breakdown */}
                  <div style={{ marginTop: "4px", paddingTop: "8px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    <span>WebP: {d.format_breakdown.webp.toLocaleString()}</span>
                    <span>JPG: {d.format_breakdown.jpg.toLocaleString()}</span>
                    <span>PNG: {d.format_breakdown.png.toLocaleString()}</span>
                  </div>
                </div>

                {/* 4. Action Buttons Toolbar (2x2 Grid matching Model Card styling) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "auto", paddingTop: "10px", borderTop: "1px solid var(--border-color)" }}>
                  {/* Top Row: Update Metadata & Audit Notebooks */}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleUpdateMetadataSingle(d)}
                    disabled={isBusy || !datasetCompilerOnline}
                    style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
                    title="Push dataset-metadata.json descriptors to Kaggle Cloud"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    <span>{actionBusyKey === `meta_${d.key}` ? "Updating..." : "Update Metadata"}</span>
                  </button>

                  <a
                    href="https://www.kaggle.com/code/lemtreursi/registry-metadata-training"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-cloud"
                    style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                    title="Open Kaggle Registry Metadata Training Audit notebook"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    <span>Audit Notebooks</span>
                  </a>

                  {/* Bottom Row: Download from Kaggle & Upload to Kaggle */}
                  <button
                    type="button"
                    className="btn btn-vault-pull"
                    onClick={() => handleDownloadManifold(d)}
                    disabled={isBusy || !datasetCompilerOnline}
                    style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
                    title={`Download ${d.display_name} from Kaggle Cloud Storage`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>{actionBusyKey === `dl_${d.key}` ? "Downloading..." : "Download"}</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-vault-push"
                    onClick={() => handleUploadManifold(d)}
                    disabled={isBusy || !datasetCompilerOnline}
                    style={{ fontSize: "11px", padding: "6px 8px", fontWeight: 600 }}
                    title={`Upload local ${d.display_name} manifold to Kaggle Cloud`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span>{actionBusyKey === `ul_${d.key}` ? "Uploading..." : "Upload"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CompilerPanel;
