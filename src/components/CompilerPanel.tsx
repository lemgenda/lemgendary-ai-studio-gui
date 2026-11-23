import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useStudioStore } from "../store/useStudioStore";
import {
  fetchDatasets,
  fetchCompilerPresets,
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
import { ValidationBanner } from "./common/ValidationBanner";
import { useCompilationForm } from "./compiler/useCompilationForm";
import { useSchemaValidation } from "./compiler/useSchemaValidation";
import { logger } from "../utils/logger";
import { useTransientValue } from "../utils/useTransientValue";
import { servicePort } from "../api/config";

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
  const [compilableDatasets, setCompilableDatasets] = useState<DatasetItem[]>(cachedDatasets);
  const [presets, setPresets] = useState<CompilerPreset[]>([]);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const [selectedManifold, setSelectedManifold] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshFeedback, showRefreshFeedback] = useTransientValue<string>(4000);

  // Search & Filter State for Manifolds Catalog
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [formatFilter, setFormatFilter] = useState<string>("ALL");
  const [taskFilter, setTaskFilter] = useState<string>("ALL");

  // Pinned Upstream Sources details
  const [pinnedSourcesManifold, setPinnedSourcesManifold] = useState<string | null>(null);

  // Card-level action busy states & status notices
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Accordion state: at most one manifold card open at a time
  const [expandedManifoldKey, setExpandedManifoldKey] = useState<string | null>(null);

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
    showRefreshFeedback(null);
    try {
      const [dsList, compilableList, presetResult] = await Promise.all([
        fetchDatasets(),
        fetchDatasets(true),
        fetchCompilerPresets().then(
          (list) => ({ list, error: null }),
          (err: unknown) => ({ list: [] as CompilerPreset[], error: err instanceof Error ? err.message : String(err) })
        ),
      ]);

      const effectiveCompilable = compilableList.length > 0 ? compilableList : dsList;
      setCompilableDatasets(effectiveCompilable);
      if (dsList.length > 0) {
        setDatasets(dsList);
        setCachedDatasets(dsList);
        setSelectedManifold((prev) => prev || effectiveCompilable[0]?.key || dsList[0].key);
        showRefreshFeedback(`Catalog refreshed: ${dsList.length} production manifolds loaded.`);
      } else if (effectiveCompilable.length > 0) {
        setDatasets([]);
        setSelectedManifold((prev) => prev || effectiveCompilable[0].key);
        showRefreshFeedback(`Catalog refreshed: ${effectiveCompilable.length} uncompiled manifolds loaded.`);
      } else {
        // Empty or unreachable sidecar: show the empty/offline state, never a hand-written catalog.
        setDatasets([]);
        showRefreshFeedback(
          datasetCompilerOnline
            ? "Dataset Compiler returned no manifolds."
            : `Dataset Compiler Sidecar (Port ${servicePort("dataset-compiler")}) is offline. The catalog stays empty until it is reachable.`
        );
      }

      // No offline preset copies: presets.yaml on the sidecar is the only source.
      setPresets(presetResult.list);
      setPresetsError(presetResult.error);
      if (presetResult.error) {
        logger.error("Failed to load compiler presets", presetResult.error);
      }
    } catch (err: unknown) {
      logger.error("Dataset Compiler refresh failed", err);
      showRefreshFeedback(`Failed to query Dataset Compiler Sidecar (Port ${servicePort("dataset-compiler")}).`);
    } finally {
      setIsRefreshing(false);
    }
  }, [datasetCompilerOnline, setCachedDatasets, showRefreshFeedback]);

  useEffect(() => {
    loadCompilerData();
  }, [loadCompilerData]);

  const compilableCatalog = useMemo(
    () => (compilableDatasets.length > 0 ? compilableDatasets : datasets),
    [compilableDatasets, datasets],
  );

  const compilationForm = useCompilationForm({
    datasetCompilerOnline,
    selectedManifold,
    datasets: compilableCatalog,
    recommendedWorkers: Math.max(
      1,
      Math.round((typeof navigator !== "undefined" && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4) * 0.7),
    ),
    addTelemetryLog,
    reloadCatalog: loadCompilerData,
  });

  const schemaValidation = useSchemaValidation(datasetCompilerOnline);

  // Per-Dataset Card Actions
  const handleDownloadManifold = async (dataset: DatasetItem) => {
    if (!datasetCompilerOnline) {
      setActionNotice(`Download failed: Dataset Compiler Sidecar (Port ${servicePort("dataset-compiler")}) is offline.`);
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
      setActionNotice(`Kaggle download initiated for ${dataset.display_name} (Job ID: ${res.id}).`);
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
      setActionNotice(`Upload failed: Dataset Compiler Sidecar (Port ${servicePort("dataset-compiler")}) is offline.`);
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
      const jobId = res.id;
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
      setActionNotice(`Metadata update failed: Dataset Compiler Sidecar (Port ${servicePort("dataset-compiler")}) is offline.`);
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
      const jobId = res.id;
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
      setQueueItems(await fetchModernizationQueue());
    } catch (err: unknown) {
      logger.error("Failed to load modernization queue", err);
      setModernizeStatus(`Error loading modernization queue: ${err instanceof Error ? err.message : String(err)}`);
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
      setModernizeStatus(`Modernization job queued: ${res.id}`);
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
      setReduceStatus(`Manifold scale reduction queued: ${res.id}`);
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
      showRefreshFeedback(`Bulk Kaggle metadata sync job started (Job ID: ${res.id}).`);
    } catch (err: unknown) {
      showRefreshFeedback(`Failed to sync metadata: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUpdatingAllMetadata(false);
    }
  };

  const handleRegenerateManifolds = async () => {
    setIsRegeneratingIndex(true);
    try {
      const res = await triggerRegenerateManifolds();
      showRefreshFeedback(res.message);
    } catch (err: unknown) {
      showRefreshFeedback(`Failed to regenerate manifolds: ${err instanceof Error ? err.message : String(err)}`);
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

  const datasetColumns = useMemo(() => {
    const cols: [DatasetItem[], DatasetItem[], DatasetItem[]] = [[], [], []];
    filteredDatasets.forEach((d, idx) => {
      cols[idx % 3].push(d);
    });
    return cols;
  }, [filteredDatasets]);

  return (
    <div className="panel-container">
      {/* ─── SECTION 1: DATASET COMPILER FORM ─────────────────────────────── */}
      <DatasetCompilationForm
        datasets={compilableCatalog}
        presets={presets}
        selectedManifold={selectedManifold}
        onSelectManifold={setSelectedManifold}
        presetsError={presetsError}
        {...compilationForm}
        datasetCompilerOnline={datasetCompilerOnline}
      />

      {/* ─── SECTION 2: PRODUCTION MANIFOLDS CATALOG & CONTROLS ────────────── */}
      <div className="card panel-section-card">
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
          isValidatingSchema={schemaValidation.isValidatingSchema}
          onValidateSchema={schemaValidation.onValidateSchema}
          totalDatasetsCount={datasets.length}
          filteredDatasetsCount={filteredDatasets.length}
        />

        {/* Global Feedback Banners */}
        {refreshFeedback && (
          <ValidationBanner
            type="info"
            message={refreshFeedback}
            className="banner-space-bottom banner-text-sm"
          />
        )}

        {schemaValidation.schemaNotice && (
          <ValidationBanner
            type={schemaValidation.schemaNotice.type}
            message={schemaValidation.schemaNotice.message}
            onDismiss={schemaValidation.onDismissSchemaNotice}
            className="banner-space-bottom banner-text-sm"
          />
        )}

        {actionNotice && (
          <ValidationBanner
            message={actionNotice}
            onDismiss={() => setActionNotice(null)}
            className="banner-space-bottom banner-text-sm"
          />
        )}

        {/* ─── TAB 1: MANIFOLDS CATALOG ─── */}
        {activeSectionTab === "catalog" && (
          <div className="card-grid card-grid-models masonry-grid">
            {filteredDatasets.length === 0 ? (
              <div className="empty-catalog-state-compact">
                {datasets.length > 0
                  ? "No dataset manifolds matched your current search and filter settings."
                  : datasetCompilerOnline
                  ? "The Dataset Compiler returned no manifolds."
                  : "No manifolds to show: the Dataset Compiler sidecar is offline. Start it to load the catalog."}
              </div>
            ) : (
              datasetColumns.map((col, colIdx) => (
                <div key={colIdx} className="masonry-column">
                  {col.map((d) => (
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
                      isExpanded={expandedManifoldKey === d.key}
                      onToggleExpand={() =>
                        setExpandedManifoldKey((prev) => (prev === d.key ? null : d.key))
                      }
                    />
                  ))}
                </div>
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
