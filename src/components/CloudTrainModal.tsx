import React, { useState, useEffect } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { ValidationBanner } from "./common/ValidationBanner";
import { Modal } from "./common/Modal";
import { ExternalLink } from "./common/ExternalLink";
import { TabItem, TabList, TabPanel } from "./common/Tabs";
import { isKernelSlug, kaggleLinkOwner, kaggleModelLinks } from "./training/kaggleLinks";
import { logger } from "../utils/logger";
import { VariationIsolationChecker } from "./training/VariationIsolationChecker";
import { KaggleKernelPicker } from "./training/KaggleKernelPicker";
import {
  DEFAULT_KAGGLE_LAUNCH_FORM,
  KaggleLaunchForm,
  KaggleLaunchOptions,
  KaggleLaunchSettings,
  KaggleMonitorSettings,
  launchSettings,
} from "./training/KaggleLaunchOptions";
import { useKaggleAccelerators } from "./training/useKaggleAccelerators";
import { useModelKaggleHandles } from "./training/useModelKaggleHandles";
import { describeKaggleAuth } from "./training/kaggleAuthStatus";
import { PushStatusMessage, summarizeKagglePush } from "./training/kagglePushSummary";
import { ModelItem, KaggleSuiteStatus, ModelValidateIsolationResponse, VariationChoice } from "../api/types";
import {
  pushKaggleModelVariation,
  validateModelIsolation,
  stageModelVariations,
  generateModelDocs,
} from "../api/client";

type CloudPlatform = "kaggle" | "colab" | "upload";

const PLATFORM_TABS: readonly TabItem<CloudPlatform>[] = [
  { id: "kaggle", label: "Kaggle Cloud" },
  { id: "colab", label: "Google Colab FUSE" },
  { id: "upload", label: "Kaggle Models Hub", domId: "train-modal-tab-upload" },
];

interface CloudTrainModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: ModelItem | null;
  onLaunchKaggle: (modelKey: string, settings: KaggleLaunchSettings) => Promise<void>;
  /** Attach to an already running Kaggle kernel (`owner/kernel-slug`). */
  onMonitorKaggle: (kernelSlug: string, modelKey: string, settings: KaggleMonitorSettings) => Promise<void>;
  kaggleAuthStatus: KaggleSuiteStatus | null;
  isBusy: boolean;
}

export const CloudTrainModal: React.FC<CloudTrainModalProps> = ({
  isOpen,
  onClose,
  model,
  onLaunchKaggle,
  onMonitorKaggle,
  kaggleAuthStatus,
  isBusy,
}) => {
  const [targetPlatform, setTargetPlatform] = useState<CloudPlatform>("kaggle");
  const [launchForm, setLaunchForm] = useState<KaggleLaunchForm>(DEFAULT_KAGGLE_LAUNCH_FORM);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [monitorSlug, setMonitorSlug] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<PushStatusMessage | null>(null);

  // Phase 8: Multi-Variation Kaggle Models Hub State
  const [selectedVariation, setSelectedVariation] = useState<VariationChoice>("all");
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

  const acceleratorChoices = useKaggleAccelerators(isOpen);
  const kaggleHandles = useModelKaggleHandles(isOpen && model ? model.key : null);

  if (!isOpen || !model) return null;

  // Slug and dataset URLs come from the Training Suite registry; the owner from the Kaggle
  // credentials, else the ecosystem kaggle_owner (the backend model sync rule).
  const kaggleLinks = kaggleModelLinks(kaggleLinkOwner(kaggleAuthStatus?.username), kaggleHandles);
  const authView = describeKaggleAuth(kaggleAuthStatus);
  const notebookFilename =
    targetPlatform === "colab"
      ? `${model.key}_colab_training.ipynb`
      : `${model.key}_kaggle_training.ipynb`;

  const handleLaunch = async () => {
    setLaunchError(null);
    try {
      await onLaunchKaggle(model.key, launchSettings(launchForm, acceleratorChoices));
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLaunchError(msg);
    }
  };

  const handleMonitor = async () => {
    setLaunchError(null);
    try {
      const { autoPull, pollInterval } = launchSettings(launchForm, acceleratorChoices);
      await onMonitorKaggle(monitorSlug.trim(), model.key, { autoPull, pollInterval });
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
      setUploadStatus({ type: "success", message: `Staged ${stagedCount} isolated variation binaries for ${model.key}.` });
      await checkIsolation(model.key);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadStatus({ type: "error", message: `Staging failed: ${msg}` });
    } finally {
      setIsStaging(false);
    }
  };

  const handleGenerateDocs = async () => {
    setIsGeneratingDocs(true);
    setUploadStatus(null);
    try {
      await generateModelDocs(model.key);
      setUploadStatus({ type: "success", message: `README.md and model-metadata.json regenerated for ${model.key}.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadStatus({ type: "error", message: `Docs generation failed: ${msg}` });
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
      setUploadStatus(summarizeKagglePush(model.key, res, dryRun));
      await checkIsolation(model.key);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadStatus({ type: "error", message: `Upload failed: ${msg}` });
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
          <HelpTooltip content="Dispatches the generated training notebook to a Kaggle session or pushes isolated multi-variation models to Kaggle Models Hub." />
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
                  <div id="cloud-modal-dataset-links" style={{ fontSize: "11px", color: "#60a5fa", fontFamily: "var(--font-mono)", display: "flex", flexDirection: "column" }}>
                    {kaggleHandles === null
                      ? "Dataset handles unavailable (Training Suite offline)"
                      : kaggleHandles.datasetUrls.length === 0
                        ? "No Kaggle dataset in the registry entry"
                        : kaggleHandles.datasetUrls.map((url) => (
                            <ExternalLink key={url} href={url}>
                              {url}
                            </ExternalLink>
                          ))}
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
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{authView.detail}</div>
                </div>
                <span
                  id="cloud-modal-auth-badge"
                  className={`badge ${authView.badge === "AUTHENTICATED" ? "badge-success" : "badge-warning"}`}
                  style={{ fontSize: "11px" }}
                >
                  {authView.badge}
                </span>
              </div>
            </div>
            {authView.problem && (
              <div id="cloud-modal-auth-error" style={{ marginTop: "8px" }}>
                <ValidationBanner type="error" role="alert" message={authView.problem} />
              </div>
            )}
          </div>

          {/* Configuration Options */}
          {targetPlatform === "kaggle" ? (
            <div style={{ marginBottom: "20px" }}>
              <KaggleLaunchOptions choices={acceleratorChoices} form={launchForm} onChange={setLaunchForm} />

              <div className="form-group">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <label htmlFor="kaggle-monitor-slug" style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    Monitor an already running kernel:
                  </label>
                  <HelpTooltip content="Attaches the Remote Cloud console to a Kaggle kernel that is already running (for example one launched from the Kaggle website), using the poll interval and auto-pull settings above. Pick one of the account's recent kernels or type its owner/kernel-slug." />
                </div>
                <KaggleKernelPicker value={monitorSlug.trim()} onPick={setMonitorSlug} disabled={isBusy} />
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    id="kaggle-monitor-slug"
                    type="text"
                    className="editor-input"
                    placeholder="owner/kernel-slug"
                    value={monitorSlug}
                    onChange={(e) => setMonitorSlug(e.target.value)}
                    style={{ flex: 1, padding: "8px 12px", fontSize: "13px" }}
                  />
                  <button
                    type="button"
                    id="kaggle-monitor-btn"
                    className="btn btn-secondary"
                    onClick={handleMonitor}
                    disabled={isBusy || !isKernelSlug(monitorSlug)}
                    title="Requires a kernel reference in the form owner/kernel-slug"
                    style={{ padding: "8px 14px", fontSize: "13px" }}
                  >
                    Attach Monitor
                  </button>
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
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Kaggle links need the model handles from the Training Suite.</span>
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

