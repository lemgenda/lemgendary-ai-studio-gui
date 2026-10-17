import React, { useState, useEffect } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { ValidationBanner } from "./common/ValidationBanner";
import { VariationIsolationChecker } from "./training/VariationIsolationChecker";
import { ModelItem, KaggleSuiteStatus, ModelValidateIsolationResponse } from "../api/types";
import {
  pushKaggleModelVariation,
  validateModelIsolation,
  stageModelVariations,
  generateModelDocs,
} from "../api/client";

interface CloudTrainModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: ModelItem | null;
  onLaunchKaggle: (modelKey: string, gpu: "T4" | "P100", autoPull: boolean) => Promise<void>;
  kaggleAuthStatus: KaggleSuiteStatus | null;
  isBusy: boolean;
}

export const CloudTrainModal: React.FC<CloudTrainModalProps> = ({
  isOpen,
  onClose,
  model,
  onLaunchKaggle,
  kaggleAuthStatus,
  isBusy,
}) => {
  const [targetPlatform, setTargetPlatform] = useState<"kaggle" | "colab" | "upload">("kaggle");
  const [selectedGpu, setSelectedGpu] = useState<"T4" | "P100">("T4");
  const [autoPull, setAutoPull] = useState<boolean>(true);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Phase 8: Multi-Variation Kaggle Models Hub State
  const [selectedVariation, setSelectedVariation] = useState<"all" | "pytorch" | "onnx_fp32" | "onnx_fp16">("all");
  const [dryRun, setDryRun] = useState<boolean>(false);
  const [isolationReport, setIsolationReport] = useState<ModelValidateIsolationResponse | null>(null);
  const [isValidatingIsolation, setIsValidatingIsolation] = useState<boolean>(false);
  const [isStaging, setIsStaging] = useState<boolean>(false);
  const [isGeneratingDocs, setIsGeneratingDocs] = useState<boolean>(false);

  const checkIsolation = React.useCallback(async (modelKey: string) => {
    setIsValidatingIsolation(true);
    try {
      const rep = await validateModelIsolation(modelKey);
      setIsolationReport(rep);
    } catch {
      setIsolationReport(null);
    } finally {
      setIsValidatingIsolation(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && model) {
      checkIsolation(model.key);
    }
  }, [isOpen, model, checkIsolation]);

  if (!isOpen || !model) return null;

  const isForex = Boolean(model.is_forex || model.task_type === "forex" || model.category === "forex");
  const datasetSlug = isForex
    ? "ForexUniverse (2019-2026)"
    : `LemGendized${model.key.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")}`;
  const datasetSearchQuery = isForex ? "lemtreursi/forexuniverse" : `lemtreursi/${model.key.replace(/_/g, "-")}`;
  const kaggleTrainingUrl = `https://www.kaggle.com/code/lemtreursi/${model.key.replace(/_/g, "-")}-training`;
  const kaggleModelHubUrl = `https://www.kaggle.com/models/lemtreursi/${model.key.replace(/_/g, "-")}`;
  const notebookFilename =
    targetPlatform === "colab"
      ? `${model.key}_colab_training.ipynb`
      : `${model.key}_kaggle_training.ipynb`;

  const handleLaunch = async () => {
    setLaunchError(null);
    try {
      await onLaunchKaggle(model.key, selectedGpu, autoPull);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLaunchError(msg);
    }
  };

  const handleStageVariations = async () => {
    setIsStaging(true);
    setUploadStatus(null);
    try {
      const res = await stageModelVariations(model.key);
      const stagedCount = Object.keys(res.staged_files || {}).length;
      setUploadStatus(`Staged ${stagedCount} isolated variation binaries for ${model.key}.`);
      await checkIsolation(model.key);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadStatus(`Staging failed: ${msg}`);
    } finally {
      setIsStaging(false);
    }
  };

  const handleGenerateDocs = async () => {
    setIsGeneratingDocs(true);
    setUploadStatus(null);
    try {
      await generateModelDocs(model.key);
      setUploadStatus(`README.md and model-metadata.json regenerated for ${model.key}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadStatus(`Docs generation failed: ${msg}`);
    } finally {
      setIsGeneratingDocs(false);
    }
  };

  const handlePushModel = async () => {
    setIsUploading(true);
    setUploadStatus(null);
    try {
      const res = await pushKaggleModelVariation({
        model: model.key,
        variation: selectedVariation,
        dry_run: dryRun,
      });
      const varCount = Object.keys(res.variations || {}).length;
      if (dryRun) {
        setUploadStatus(`[DRY RUN PASSED] Verified ${varCount} variation payload(s) for ${model.key} with strict isolation.`);
      } else {
        setUploadStatus(`Successfully published ${varCount} variation(s) for ${model.key} to Kaggle Models Hub.`);
      }
      await checkIsolation(model.key);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadStatus(`Upload failed: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cloud-modal-title">
      <div className="modal-content" style={{ maxWidth: "720px", height: "auto", maxHeight: "90vh", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h3 id="cloud-modal-title" style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              Cloud &amp; Registry Dispatch: {model.display_name}
            </h3>
            <HelpTooltip content="Dispatches remote execution notebooks to Kaggle GPU cloud or pushes isolated multi-variation models to Kaggle Models Hub." />
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            aria-label="Close cloud training modal"
            style={{ padding: "4px 10px", fontSize: "14px" }}
          >
            X
          </button>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {/* Platform Switcher */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px", background: "rgba(255,255,255,0.03)", padding: "4px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
            <button
              type="button"
              className={`btn ${targetPlatform === "kaggle" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTargetPlatform("kaggle")}
              style={{ flex: 1, padding: "8px 12px", fontSize: "13px", fontWeight: 600 }}
            >
              Kaggle GPU Cloud
            </button>
            <button
              type="button"
              className={`btn ${targetPlatform === "colab" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTargetPlatform("colab")}
              style={{ flex: 1, padding: "8px 12px", fontSize: "13px", fontWeight: 600 }}
            >
              Google Colab FUSE
            </button>
            <button
              type="button"
              className={`btn ${targetPlatform === "upload" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTargetPlatform("upload")}
              style={{ flex: 1, padding: "8px 12px", fontSize: "13px", fontWeight: 600 }}
            >
              Kaggle Models Hub
            </button>
          </div>

          {/* Pre-Flight Checklist */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: 700, margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Pre-Flight Environment Verification
              </h4>
              <HelpTooltip content="Authoritative pre-execution check verifying that datasets, notebook templates, credentials, and checkpoint vaults exist before triggering cloud compute." />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Check 1: Notebook Template */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", padding: "10px 14px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>Canonical Notebook Template</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{notebookFilename}</div>
                </div>
                <span className="badge badge-success" style={{ fontSize: "11px" }}>READY</span>
              </div>

              {/* Check 2: Dataset Manifold */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", padding: "10px 14px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>Required Dataset Manifold</div>
                  <div style={{ fontSize: "11px", color: "#60a5fa", fontFamily: "var(--font-mono)" }}>
                    {datasetSlug} (search: {datasetSearchQuery})
                  </div>
                </div>
                <span className="badge badge-info" style={{ fontSize: "11px" }}>AUTO-DISCOVERED</span>
              </div>

              {/* Check 3: Checkpoint Vault */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", padding: "10px 14px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>Checkpoint Vault (Resume Capability)</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    LemGendaryModels/{model.key}/checkpoints/
                  </div>
                </div>
                <span className={`badge ${model.checkpoint_exists ? "badge-success" : "badge-secondary"}`} style={{ fontSize: "11px" }}>
                  {model.checkpoint_exists ? "RECOVERY READY" : "COLD START"}
                </span>
              </div>

              {/* Check 4: Cloud Credentials */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", padding: "10px 14px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>API Authentication</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {kaggleAuthStatus?.authenticated ? `Authenticated as @${kaggleAuthStatus.username}` : "Local Credentials / Token"}
                  </div>
                </div>
                <span className={`badge ${kaggleAuthStatus?.authenticated ? "badge-success" : "badge-warning"}`} style={{ fontSize: "11px" }}>
                  {kaggleAuthStatus?.authenticated ? "AUTHENTICATED" : "CHECK SECRETS"}
                </span>
              </div>
            </div>
          </div>

          {/* Configuration Options */}
          {targetPlatform === "kaggle" ? (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div className="form-group">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    <label htmlFor="gpu-select" style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Target Cloud GPU Accelerator:
                    </label>
                    <HelpTooltip content="Choose cloud GPU. Dual T4 x2 provides 30GB aggregate memory for high-resolution ladders; P100 provides dedicated fast single-chip compute." />
                  </div>
                  <select
                    id="gpu-select"
                    className="editor-select"
                    value={selectedGpu}
                    onChange={(e) => setSelectedGpu(e.target.value as "T4" | "P100")}
                    style={{ width: "100%", padding: "8px 12px", fontSize: "13px" }}
                  >
                    <option value="T4">GPU T4 x2 (30 GB combined VRAM)</option>
                    <option value="P100">GPU P100 (16 GB dedicated VRAM)</option>
                  </select>
                </div>

                <div className="form-group" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-primary)", cursor: "pointer", userSelect: "none", paddingBottom: "8px" }}>
                    <input
                      type="checkbox"
                      checked={autoPull}
                      onChange={(e) => setAutoPull(e.target.checked)}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                    />
                    <span>Auto-pull checkpoints to LemGendaryModels</span>
                    <HelpTooltip content="Automatically pulls latest .pth, .onnx, and metrics.csv artifacts down to local LemGendaryModels upon epoch completion." />
                  </label>
                </div>
              </div>
            </div>
          ) : targetPlatform === "colab" ? (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "14px", marginBottom: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Google Colab execution mounts <strong>Google Drive FUSE</strong> directly at <code>/content/drive/MyDrive/LemGendaryModels</code>.
                Background daemon threads stream updated model weights and metrics every 30 seconds.
              </div>
            </div>
          ) : (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
              <div style={{ marginBottom: "12px" }}>
                <h4 style={{ fontSize: "13px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                  Kaggle Models Hub — Multi-Variation Isolated Staging
                </h4>
              </div>
              <VariationIsolationChecker
                modelKey={model.key}
                isolationReport={isolationReport}
                isValidatingIsolation={isValidatingIsolation}
                isGeneratingDocs={isGeneratingDocs}
                isStaging={isStaging}
                isBusy={isBusy}
                onGenerateDocs={handleGenerateDocs}
                onStageVariations={handleStageVariations}
                selectedVariation={selectedVariation}
                onSelectVariation={setSelectedVariation}
                dryRun={dryRun}
                onToggleDryRun={setDryRun}
                uploadStatus={uploadStatus}
              />
            </div>
          )}

          {launchError && (
            <ValidationBanner
              type="error"
              message={launchError}
              onDismiss={() => setLaunchError(null)}
              style={{ marginBottom: "16px" }}
            />
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--border-color)", paddingTop: "16px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <a
                href={kaggleTrainingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ padding: "6px 12px", fontSize: "12px", textDecoration: "none" }}
              >
                Kaggle Notebook
              </a>
              <a
                href={kaggleModelHubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ padding: "6px 12px", fontSize: "12px", textDecoration: "none" }}
              >
                Kaggle Model Hub
              </a>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isBusy || isUploading}
                style={{ padding: "8px 16px", fontSize: "13px" }}
              >
                Cancel
              </button>

              {targetPlatform === "kaggle" && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleLaunch}
                  disabled={isBusy}
                  style={{ padding: "8px 20px", fontSize: "13px", fontWeight: 600 }}
                >
                  {isBusy ? "Dispatching..." : "Launch Cloud Training"}
                </button>
              )}

              {targetPlatform === "upload" && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handlePushModel}
                  disabled={isUploading}
                  style={{ padding: "8px 20px", fontSize: "13px", fontWeight: 600 }}
                >
                  {isUploading ? "Processing..." : dryRun ? "Validate Isolation (Dry Run)" : "Push to Kaggle Models"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

