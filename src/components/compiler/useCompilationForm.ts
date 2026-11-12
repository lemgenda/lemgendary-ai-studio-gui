/**
 * LemGendary AI Studio - state and submit handlers of the dataset compilation
 * form: standard preset compile, custom multi-source compile and direct Kaggle ingestion.
 */

import { useState } from "react";
import { downloadKaggleDataset, triggerCustomCompile, triggerQuickCompile } from "../../api/client";
import { CompilationFormControls } from "./DatasetCompilationForm";
import { servicePort } from "../../api/config";
import { parseCompileLimits } from "./compileLimits";

export interface CompilationFormDeps {
  datasetCompilerOnline: boolean;
  /** Manifold the standard compile targets. */
  selectedManifold: string;
  addTelemetryLog: (message: string) => void;
  /** Reload the catalog after a job that adds or changes a manifold. */
  reloadCatalog: () => void;
}

export function useCompilationForm({
  datasetCompilerOnline,
  selectedManifold,
  addTelemetryLog,
  reloadCatalog,
}: CompilationFormDeps): CompilationFormControls {
  // "" = omit `preset` so the sidecar applies its own default.
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  // Optional quick-compile overrides; "" leaves them to the preset / sidecar.
  const [compileMaxGb, setCompileMaxGb] = useState<string>("");
  const [compileWorkers, setCompileWorkers] = useState<string>("");
  // "" = omit `shard_ext` so the compiler writes its default `.data` shards.
  const [compileShardExt, setCompileShardExt] = useState<string>("");
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compileStatus, setCompileStatus] = useState<string | null>(null);

  // Compilation Mode (Standard vs Custom Multi-Source)
  const [compileMode, setCompileMode] = useState<"standard" | "custom">("standard");
  const [customName, setCustomName] = useState<string>("");
  const [customTask, setCustomTask] = useState<string>("restoration");
  const [customPreset, setCustomPreset] = useState<string>("");
  const [customCanonicalFormat, setCustomCanonicalFormat] = useState<"webdataset" | "parquet" | "mds" | "litdata">("webdataset");
  const [customShardSize, setCustomShardSize] = useState<number>(5000);
  const [customSourcesText, setCustomSourcesText] = useState<string>("");
  const [customPurgeLoose, setCustomPurgeLoose] = useState<boolean>(true);
  const [isCustomCompiling, setIsCustomCompiling] = useState<boolean>(false);
  const [customCompileStatus, setCustomCompileStatus] = useState<string | null>(null);

  // Custom Kaggle Link / Slug Download Bar state
  const [customKaggleRef, setCustomKaggleRef] = useState<string>("");
  const [downloadTargetFolder, setDownloadTargetFolder] = useState<string>("");
  const [downloadForce, setDownloadForce] = useState<boolean>(false);
  const [isDownloadingKaggle, setIsDownloadingKaggle] = useState<boolean>(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  // Standard Compile Handler
  const handleCompile = async () => {
    if (!datasetCompilerOnline) {
      setCompileStatus(`Compilation failed: Dataset Compiler Sidecar (Port ${servicePort("dataset-compiler")}) is not reachable.`);
      return;
    }
    const limits = parseCompileLimits(compileMaxGb, compileWorkers);
    if (!limits.ok) {
      setCompileStatus(`Compilation not started: ${limits.error}`);
      return;
    }
    setIsCompiling(true);
    setCompileStatus(null);
    try {
      const res = await triggerQuickCompile({
        model: selectedManifold,
        ...(selectedPreset ? { preset: selectedPreset } : {}),
        ...limits.overrides,
        ...(compileShardExt ? { shard_ext: compileShardExt } : {}),
      });
      setCompileStatus(`Compilation initiated successfully (Job ID: ${res.id}). Telemetry streaming to monitor below.`);
      addTelemetryLog(`Initiated compilation for manifold '${selectedManifold}' [Job: ${res.id}]`);
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
      setCustomCompileStatus(`Custom compile failed: Dataset Compiler Sidecar (Port ${servicePort("dataset-compiler")}) is not reachable.`);
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
        ...(customPreset ? { preset: customPreset } : {}),
        canonical_format: customCanonicalFormat,
        shard_size: customShardSize,
        sources: rawLines,
        purge_loose_images: customPurgeLoose,
      });
      setCustomCompileStatus(`Custom compilation initiated successfully (Job ID: ${res.id}). Added to unified_data.yaml.`);
      addTelemetryLog(`Custom compilation started for '${trimmedName}' [Job: ${res.id}]`);
      reloadCatalog();
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
      setDownloadStatus(`Kaggle download failed: Dataset Compiler Sidecar (Port ${servicePort("dataset-compiler")}) is offline.`);
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
      setDownloadStatus(`Kaggle download initiated for ${targetRef} (Job ID: ${res.id}). Streaming to disk.`);
      reloadCatalog();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setDownloadStatus(`Download failed: ${msg}`);
    } finally {
      setIsDownloadingKaggle(false);
    }
  };

  return {
    selectedPreset,
    onSelectPreset: setSelectedPreset,
    compileMaxGb,
    onChangeCompileMaxGb: setCompileMaxGb,
    compileWorkers,
    onChangeCompileWorkers: setCompileWorkers,
    compileShardExt,
    onChangeCompileShardExt: setCompileShardExt,
    isCompiling,
    compileStatus,
    onCompile: handleCompile,
    compileMode,
    onChangeCompileMode: setCompileMode,
    customName,
    onChangeCustomName: setCustomName,
    customTask,
    onChangeCustomTask: setCustomTask,
    customPreset,
    onChangeCustomPreset: setCustomPreset,
    customCanonicalFormat,
    onChangeCustomCanonicalFormat: setCustomCanonicalFormat,
    customShardSize,
    onChangeCustomShardSize: setCustomShardSize,
    customSourcesText,
    onChangeCustomSourcesText: setCustomSourcesText,
    customPurgeLoose,
    onToggleCustomPurgeLoose: setCustomPurgeLoose,
    isCustomCompiling,
    customCompileStatus,
    onCustomCompile: handleCustomCompile,
    customKaggleRef,
    onChangeCustomKaggleRef: setCustomKaggleRef,
    downloadTargetFolder,
    onChangeDownloadTargetFolder: setDownloadTargetFolder,
    downloadForce,
    onToggleDownloadForce: setDownloadForce,
    isDownloadingKaggle,
    downloadStatus,
    onDownloadKaggleDirect: handleCustomKaggleDownload,
  };
}
