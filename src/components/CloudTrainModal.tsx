import React, { useState, useEffect } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { ValidationBanner } from "./common/ValidationBanner";
import { Modal } from "./common/Modal";
import { ExternalLink } from "./common/ExternalLink";
import { TabItem, TabList, TabPanel } from "./common/Tabs";
import { kaggleModelLinks } from "./training/kaggleLinks";
import { logger } from "../utils/logger";
import { VariationIsolationChecker } from "./training/VariationIsolationChecker";
import { ModelItem, KaggleSuiteStatus, ModelValidateIsolationResponse } from "../api/types";
import {
  pushKaggleModelVariation,
  validateModelIsolation,
  stageModelVariations,
  generateModelDocs,
} from "../api/client";

type CloudPlatform = "kaggle" | "colab" | "upload";

const PLATFORM_TABS: readonly TabItem<CloudPlatform>[] = [
  { id: "kaggle", label: "Kaggle GPU Cloud" },
  { id: "colab", label: "Google Colab FUSE" },
  { id: "upload", label: "Kaggle Models Hub", domId: "train-modal-tab-upload" },
];

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
  const [targetPlatform, setTargetPlatform] = useState<CloudPlatform>("kaggle");
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
    } catch (err: unknown) {
      logger.warn(`Variation isolation check failed for ${modelKey}`, err);
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
  // Owner comes from the Kaggle credentials; without them no Kaggle link can be built.
  const kaggleLinks = kaggleModelLinks(kaggleAuthStatus?.username, model, isForex);
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      id="cloud-modal"
      className="modal-content-medium"
      title={`Cloud & Registry Dispatch: ${model.display_name}`}
      headerActions={
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <HelpTooltip content="Dispatches remote execution notebooks to Kaggle GPU cloud or pushes isolated multi-variation models to Kaggle Models Hub." />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Close cloud training modal"
          >
            Close
          </button>
        </div>
      }
    >
          {/* Platform Switcher */}
          <TabList
            idPrefix="cloud-modal"
            label="Cloud target platform"
            items={PLATFORM_TABS}
            value={targetPlatform}
            onChange={setTargetPlatform}
            tabClassName={(selected) => `btn ${selected ? "btn-primary" : "btn-secondary"}`}
            style={{ display: "flex", gap: "8px", background: "rgba(255,255,255,0.03)", padding: "4px", borderRadius: "8px", border: "1px solid var(--border-color)" }}
            tabStyle={{ flex: 1, padding: "8px 12px", fontSize: "13px", fontWeight: 600 }}
          />

          <TabPanel idPrefix="cloud-modal" items={PLATFORM_TABS} value={targetPlatform}>
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
                <span className="badge badge-secondary" style={{ fontSize: "11px" }} title="The sidecar generates the notebook when the job is dispatched; it is not checked beforehand.">
                  GENERATED ON LAUNCH
                </span>
              </div>

              {/* Check 2: Dataset Manifold */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", padding: "10px 14px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>Required Dataset Manifold</div>
                  <div style={{ fontSize: "11px", color: "#60a5fa", fontFamily: "var(--font-mono)" }}>
                    {datasetSlug}
                    {kaggleLinks ? ` (search: ${kaggleLinks.datasetSearch})` : " (Kaggle username unknown: set the Kaggle credentials)"}
                  </div>
                </div>
                <span className="badge badge-secondary" style={{ fontSize: "11px" }} title="The notebook resolves the dataset on Kaggle at run time; the GUI does not check that it exists.">
                  NOT CHECKED
                </span>
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
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingBottom: "8px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-primary)", cursor: "pointer", userSelect: "none" }}>
                      <input
                        type="checkbox"
                        checked={autoPull}
                        onChange={(e) => setAutoPull(e.target.checked)}
                        style={{ cursor: "pointer", width: "16px", height: "16px" }}
                      />
                      <span>Auto-pull checkpoints to LemGendaryModels</span>
                    </label>
                    <HelpTooltip content="Automatically pulls latest .pth, .onnx, and metrics.csv artifacts down to local LemGendaryModels upon epoch completion." />
                  </div>
                </div>
              </div>
            </div>
          ) : targetPlatform === "colab" ? (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "14px", marginBottom: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Google Colab execution mounts <strong>Google Drive FUSE</strong> directly at <code>/content/drive/MyDrive/LemGendaryModels</code>.
                Background daemon threads stream updated model weights and metrics every 30 seconds.
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6, marginTop: "8px" }}>
                The GUI cannot launch Colab runs: generate the training notebook from the model card and open it in Colab yourself.
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
              {kaggleLinks ? (
                <>
                  <ExternalLink
                    href={kaggleLinks.notebookUrl}
                    className="btn btn-secondary"
                    style={{ padding: "6px 12px", fontSize: "12px", textDecoration: "none" }}
                  >
                    Kaggle Notebook
                  </ExternalLink>
                  <ExternalLink
                    href={kaggleLinks.modelHubUrl}
                    className="btn btn-secondary"
                    style={{ padding: "6px 12px", fontSize: "12px", textDecoration: "none" }}
                  >
                    Kaggle Model Hub
                  </ExternalLink>
                </>
              ) : (
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Kaggle links need the Kaggle credentials (username).</span>
              )}
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
          </TabPanel>
    </Modal>
  );
};

