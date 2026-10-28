import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useStudioStore } from "../store/useStudioStore";
import {
  fetchDatasets,
  fetchCompilerPresets,
  triggerQuickCompile,
  triggerCustomCompile,
  downloadKaggleDataset,
  uploadKaggleDataset,
  updateKaggleMetadata,
  updateAllKaggleMetadata,
  fetchModernizationQueue,
  triggerModernizationRun,
  triggerManifoldReduce,
  triggerRegenerateManifolds,
} from "../api/client";
import {
  CompilerPreset,
  DatasetItem,
  ModernizationQueueItem,
} from "../api/types";
import { CompilerToolbar } from "./compiler/CompilerToolbar";
import { DatasetCompilationForm } from "./compiler/DatasetCompilationForm";
import { DatasetManifoldCard } from "./compiler/DatasetManifoldCard";
import { ModernizationQueueTable } from "./compiler/ModernizationQueueTable";
import { ScaleReductionView } from "./compiler/ScaleReductionView";
import { FALLBACK_COMPILER_PRESETS, FALLBACK_DATASETS } from "./compiler/fallbackDatasets";
import { ValidationBanner } from "./common/ValidationBanner";

interface CompilerPanelProps {
  datasetCompilerOnline?: boolean;
}

export const CompilerPanel: React.FC<CompilerPanelProps> = ({ datasetCompilerOnline: propOnline }) => {
  const storeDatasetsOnline = useStudioStore((s) => s.meshStatus.datasetCompiler);
  const datasetCompilerOnline = propOnline !== undefined ? propOnline : storeDatasetsOnline;
  const cachedDatasets = useStudioStore((s) => s.cachedDatasets);
  const setCachedDatasets = useStudioStore((s) => s.setCachedDatasets);
  const addTelemetryLog = useStudioStore((s) => s.addTelemetryLog);

  // Production Datasets & Presets
  const [datasets, setDatasets] = useState<DatasetItem[]>(cachedDatasets);
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

  // Search & Filter State for Manifolds Catalog
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [formatFilter, setFormatFilter] = useState<string>("ALL");
  const [taskFilter, setTaskFilter] = useState<string>("ALL");

  // Pinned Upstream Sources details
  const [pinnedSourcesManifold, setPinnedSourcesManifold] = useState<string | null>(null);

  // Custom Kaggle Link / Slug Download Bar state
  const [customKaggleRef, setCustomKaggleRef] = useState<string>("");
  const [downloadTargetFolder, setDownloadTargetFolder] = useState<string>("");
  const [downloadForce, setDownloadForce] = useState<boolean>(false);
  const [isDownloadingKaggle, setIsDownloadingKaggle] = useState<boolean>(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  // Card-level action busy states & status notices
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Section Tab State (Catalog vs Modernization Queue vs Scale Reduction)
  const [activeSectionTab, setActiveSectionTab] = useState<"catalog" | "modernize" | "reduction">("catalog");
  const [queueItems, setQueueItems] = useState<ModernizationQueueItem[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(false);
  const [modernizeWorkers, setModernizeWorkers] = useState<number>(4);
  const [modernizePushKaggle, setModernizePushKaggle] = useState<boolean>(false);
  const [modernizeForce, setModernizeForce] = useState<boolean>(false);
  const [modernizeDryRun, setModernizeDryRun] = useState<boolean>(false);
  const [isModernizing, setIsModernizing] = useState<boolean>(false);
  const [modernizeStatus, setModernizeStatus] = useState<string | null>(null);

  // Scale Reduction State
  const [reduceManifold, setReduceManifold] = useState<string>("");
  const [reduceScale, setReduceScale] = useState<number>(0.25);
  const [isReducing, setIsReducing] = useState<boolean>(false);
  const [reduceStatus, setReduceStatus] = useState<string | null>(null);

  // Global Actions State
  const [isUpdatingAllMetadata, setIsUpdatingAllMetadata] = useState<boolean>(false);
  const [isRegeneratingIndex, setIsRegeneratingIndex] = useState<boolean>(false);

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
        setCachedDatasets(dsList);
        setSelectedManifold((prev) => prev || dsList[0].key);
        setRefreshFeedback(`Catalog refreshed: ${dsList.length} production manifolds loaded.`);
      } else {
        setDatasets(FALLBACK_DATASETS);
        setCachedDatasets(FALLBACK_DATASETS);
        setSelectedManifold((prev) => prev || "upn_v2");
        if (!datasetCompilerOnline) {
          setRefreshFeedback("Dataset Compiler Sidecar (Port 8100) is offline. Displaying cached registry catalog.");
        }
      }

      if (prList.length > 0) {
        setPresets(prList);
      } else {
        setPresets(FALLBACK_COMPILER_PRESETS);
      }
    } catch {
      setRefreshFeedback("Failed to query Dataset Compiler Sidecar (Port 8100).");
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshFeedback(null), 4000);
    }
  }, [datasetCompilerOnline, setCachedDatasets]);

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
      addTelemetryLog(`Initiated compilation for manifold '${selectedManifold}' [Job: ${res.job_id || "Active"}]`);
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
      addTelemetryLog(`Custom compilation started for '${trimmedName}' [Job: ${res.job_id || "Active"}]`);
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
      const jobId = res.job_id || res.id || "Active";
      setActionNotice(`Kaggle upload initiated for ${dataset.display_name} (Job ID: ${jobId}).`);
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
      const jobId = res.job_id || res.id || "Active";
      setActionNotice(`Pushed dataset-metadata.json descriptors to Kaggle for ${dataset.display_name} (Job ID: ${jobId}).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setActionNotice(`Metadata update failed for ${dataset.display_name}: ${msg}`);
    } finally {
      setActionBusyKey(null);
    }
  };

  const loadModernizationQueue = useCallback(async () => {
    setIsLoadingQueue(true);
    try {
      const res = await fetchModernizationQueue();
      setQueueItems(res.queue || []);
    } catch (err: unknown) {
      console.error("Failed to load modernization queue:", err);
    } finally {
      setIsLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    if (activeSectionTab === "modernize") {
      loadModernizationQueue();
    }
  }, [activeSectionTab, loadModernizationQueue]);

  const handleRunModernize = async (datasetKey?: string) => {
    setIsModernizing(true);
    setModernizeStatus(null);
    try {
      const res = await triggerModernizationRun({
        dataset: datasetKey,
        workers: modernizeWorkers,
        push_kaggle: modernizePushKaggle,
        force: modernizeForce,
        dry_run: modernizeDryRun,
      });
      setModernizeStatus(`Modernization job queued: ${res.job_id || "running"}`);
      await loadModernizationQueue();
    } catch (err: unknown) {
      setModernizeStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsModernizing(false);
    }
  };

  const handleRunReduce = async () => {
    if (!reduceManifold) {
      setReduceStatus("Please select a target manifold to downsample.");
      return;
    }
    setIsReducing(true);
    setReduceStatus(null);
    try {
      const res = await triggerManifoldReduce({
        manifold: reduceManifold,
        scale: reduceScale,
      });
      setReduceStatus(`Manifold scale reduction queued: ${res.job_id || "running"}`);
    } catch (err: unknown) {
      setReduceStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsReducing(false);
    }
  };

  const handleUpdateAllMetadata = async () => {
    setIsUpdatingAllMetadata(true);
    try {
      const res = await updateAllKaggleMetadata();
      setRefreshFeedback(`Bulk Kaggle metadata sync job started (Job ID: ${res.job_id || "active"}).`);
    } catch (err: unknown) {
      setRefreshFeedback(`Failed to sync metadata: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUpdatingAllMetadata(false);
    }
  };

  const handleRegenerateManifolds = async () => {
    setIsRegeneratingIndex(true);
    try {
      const res = await triggerRegenerateManifolds();
      setRefreshFeedback(`Regenerated manifolds index (Job ID: ${res.job_id || "active"}).`);
    } catch (err: unknown) {
      setRefreshFeedback(`Failed to regenerate manifolds: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRegeneratingIndex(false);
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

      if (statusFilter !== "ALL") {
        if (statusFilter === "COMPILED" && !d.is_compiled) return false;
        if (statusFilter === "UNCOMPILED" && d.is_compiled) return false;
      }

      if (formatFilter !== "ALL") {
        const f = (d.canonical_format || d.format || "").toLowerCase();
        if (f !== formatFilter.toLowerCase()) return false;
      }

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
      {/* ─── SECTION 1: DATASET COMPILER FORM ─────────────────────────────── */}
      <DatasetCompilationForm
        datasets={datasets}
        presets={presets}
        selectedManifold={selectedManifold}
        onSelectManifold={setSelectedManifold}
        selectedPreset={selectedPreset}
        onSelectPreset={setSelectedPreset}
        shardSize={shardSize}
        onChangeShardSize={setShardSize}
        purgeLooseImages={purgeLooseImages}
        onTogglePurgeLooseImages={setPurgeLooseImages}
        isCompiling={isCompiling}
        compileStatus={compileStatus}
        onCompile={handleCompile}
        compileMode={compileMode}
        onChangeCompileMode={setCompileMode}
        customName={customName}
        onChangeCustomName={setCustomName}
        customTask={customTask}
        onChangeCustomTask={setCustomTask}
        customPreset={customPreset}
        onChangeCustomPreset={setCustomPreset}
        customCanonicalFormat={customCanonicalFormat}
        onChangeCustomCanonicalFormat={setCustomCanonicalFormat}
        customShardSize={customShardSize}
        onChangeCustomShardSize={setCustomShardSize}
        customSourcesText={customSourcesText}
        onChangeCustomSourcesText={setCustomSourcesText}
        customPurgeLoose={customPurgeLoose}
        onToggleCustomPurgeLoose={setCustomPurgeLoose}
        isCustomCompiling={isCustomCompiling}
        customCompileStatus={customCompileStatus}
        onCustomCompile={handleCustomCompile}
        customKaggleRef={customKaggleRef}
        onChangeCustomKaggleRef={setCustomKaggleRef}
        downloadTargetFolder={downloadTargetFolder}
        onChangeDownloadTargetFolder={setDownloadTargetFolder}
        downloadForce={downloadForce}
        onToggleDownloadForce={setDownloadForce}
        isDownloadingKaggle={isDownloadingKaggle}
        downloadStatus={downloadStatus}
        onDownloadKaggleDirect={handleCustomKaggleDownload}
        datasetCompilerOnline={datasetCompilerOnline}
      />

      {/* ─── SECTION 2: PRODUCTION MANIFOLDS CATALOG & CONTROLS ────────────── */}
      <div className="card" style={{ marginTop: "20px", padding: "20px" }}>
        <CompilerToolbar
          activeSectionTab={activeSectionTab}
          onTabChange={setActiveSectionTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          formatFilter={formatFilter}
          onFormatFilterChange={setFormatFilter}
          taskFilter={taskFilter}
          onTaskFilterChange={setTaskFilter}
          uniqueFormats={uniqueFormats}
          uniqueTasks={uniqueTasks}
          onResetFilters={() => {
            setSearchQuery("");
            setStatusFilter("ALL");
            setFormatFilter("ALL");
            setTaskFilter("ALL");
          }}
          datasetCompilerOnline={datasetCompilerOnline}
          isRefreshing={isRefreshing}
          onRefreshCatalog={loadCompilerData}
          isUpdatingAllMetadata={isUpdatingAllMetadata}
          onUpdateAllMetadata={handleUpdateAllMetadata}
          isRegeneratingIndex={isRegeneratingIndex}
          onRegenerateIndex={handleRegenerateManifolds}
          totalDatasetsCount={datasets.length}
          filteredDatasetsCount={filteredDatasets.length}
        />

        {/* Global Feedback Banners */}
        {refreshFeedback && (
          <ValidationBanner
            type="info"
            message={refreshFeedback}
            style={{ marginBottom: "16px", fontSize: "12px" }}
          />
        )}

        {actionNotice && (
          <ValidationBanner
            message={actionNotice}
            onDismiss={() => setActionNotice(null)}
            style={{ marginBottom: "16px", fontSize: "12px" }}
          />
        )}

        {/* ─── TAB 1: MANIFOLDS CATALOG ─── */}
        {activeSectionTab === "catalog" && (
          <div className="card-grid card-grid-models">
            {filteredDatasets.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                No dataset manifolds matched your current search and filter settings.
              </div>
            ) : (
              filteredDatasets.map((d) => (
                <DatasetManifoldCard
                  key={d.key}
                  dataset={d}
                  isBusy={
                    actionBusyKey === `dl_${d.key}` ||
                    actionBusyKey === `ul_${d.key}` ||
                    actionBusyKey === `meta_${d.key}`
                  }
                  actionBusyKey={actionBusyKey}
                  isSourcesPinned={pinnedSourcesManifold === d.key}
                  onToggleSourcesPin={() => toggleSourcesPin(d.key)}
                  onUpdateMetadataSingle={handleUpdateMetadataSingle}
                  onDownloadManifold={handleDownloadManifold}
                  onUploadManifold={handleUploadManifold}
                  datasetCompilerOnline={datasetCompilerOnline}
                />
              ))
            )}
          </div>
        )}

        {/* ─── TAB 2: MODERNIZATION QUEUE & TRANSCODE ─── */}
        {activeSectionTab === "modernize" && (
          <ModernizationQueueTable
            queueItems={queueItems}
            isLoadingQueue={isLoadingQueue}
            isModernizing={isModernizing}
            datasetCompilerOnline={datasetCompilerOnline}
            modernizeWorkers={modernizeWorkers}
            setModernizeWorkers={setModernizeWorkers}
            modernizePushKaggle={modernizePushKaggle}
            setModernizePushKaggle={setModernizePushKaggle}
            modernizeForce={modernizeForce}
            setModernizeForce={setModernizeForce}
            modernizeDryRun={modernizeDryRun}
            setModernizeDryRun={setModernizeDryRun}
            modernizeStatus={modernizeStatus}
            onScanQueue={loadModernizationQueue}
            onRunModernize={handleRunModernize}
          />
        )}

        {/* ─── TAB 3: SCALE REDUCTION ─── */}
        {activeSectionTab === "reduction" && (
          <ScaleReductionView
            datasets={datasets}
            reduceManifold={reduceManifold}
            setReduceManifold={setReduceManifold}
            reduceScale={reduceScale}
            setReduceScale={setReduceScale}
            isReducing={isReducing}
            datasetCompilerOnline={datasetCompilerOnline}
            reduceStatus={reduceStatus}
            onRunReduce={handleRunReduce}
          />
        )}
      </div>
    </div>
  );
};

export default CompilerPanel;
