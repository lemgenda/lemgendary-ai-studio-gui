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
import { isAdvancedFormValid } from "./training/kaggleAdvancedLaunch";
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

  // The Advanced group shows each refused value under its field; nothing is sent until it is fixed.
  const launchFormValid = isAdvancedFormValid(launchForm.advanced);

  const handleLaunch = async () => {
    setLaunchError(null);
    if (!launchFormValid) return;
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
        <div className="modal-header-actions-row">
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
            className="modal-tablist"
            tabClassName={(selected) => `btn modal-tab-option ${selected ? "btn-primary" : "btn-secondary"}`}
          />

          <TabPanel idPrefix="cloud-modal" items={PLATFORM_TABS} value={targetPlatform}>
          {/* Pre-Flight Checklist */}
          <div className="modal-section-mb-lg">
            <div className="modal-section-header">
              <h4 className="section-kicker">
                Pre-Flight Environment Verification
              </h4>
              <HelpTooltip content="Authoritative pre-execution check verifying that datasets, notebook templates, credentials, and checkpoint vaults exist before triggering cloud compute." />
            </div>

            <div className="modal-checklist">
              {/* Check 1: Notebook Template */}
              <div className="modal-checklist-item">
                <div>
                  <div className="modal-checklist-title">Canonical Notebook Template</div>
                  <div className="modal-checklist-mono">{notebookFilename}</div>
                </div>
                <span className="badge badge-secondary" title="The sidecar generates the notebook when the job is dispatched; it is not checked beforehand.">
                  GENERATED ON LAUNCH
                </span>
              </div>

              {/* Check 2: Dataset Manifold */}
              <div className="modal-checklist-item">
                <div>
                  <div className="modal-checklist-title">Required Dataset Manifold</div>
                  <div id="cloud-modal-dataset-links" className="modal-checklist-links">
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
                <span className="badge badge-secondary" title="The notebook resolves the dataset on Kaggle at run time; the GUI does not check that it exists.">
                  NOT CHECKED
                </span>
              </div>

              {/* Check 3: Checkpoint Vault */}
              <div className="modal-checklist-item">
                <div>
                  <div className="modal-checklist-title">Checkpoint Vault (Resume Capability)</div>
                  <div className="modal-checklist-mono">
                    LemGendaryModels/{model.key}/checkpoints/
                  </div>
                </div>
                <span className={`badge ${model.checkpoint_exists ? "badge-success" : "badge-secondary"}`}>
                  {model.checkpoint_exists ? "RECOVERY READY" : "COLD START"}
                </span>
              </div>

              {/* Check 4: Cloud Credentials */}
              <div className="modal-checklist-item">
                <div>
                  <div className="modal-checklist-title">API Authentication</div>
                  <div className="modal-checklist-sub">{authView.detail}</div>
                </div>
                <span
                  id="cloud-modal-auth-badge"
                  className={`badge ${authView.badge === "AUTHENTICATED" ? "badge-success" : "badge-warning"}`}
                >
                  {authView.badge}
                </span>
              </div>
            </div>
            {authView.problem && (
              <div id="cloud-modal-auth-error" className="modal-checklist-error">
                <ValidationBanner type="error" role="alert" message={authView.problem} />
              </div>
            )}
          </div>

          {/* Configuration Options */}
          {targetPlatform === "kaggle" ? (
            <div className="modal-section-mb-lg">
              <KaggleLaunchOptions choices={acceleratorChoices} form={launchForm} onChange={setLaunchForm} />

              <div className="form-group">
                <div className="form-field-label-row">
                  <label htmlFor="kaggle-monitor-slug" className="form-field-label-sm">
                    Monitor an already running kernel:
                  </label>
                  <HelpTooltip content="Attaches the Remote Cloud console to a Kaggle kernel that is already running (for example one launched from the Kaggle website), using the poll interval and auto-pull settings above. Pick one of the account's recent kernels or type its owner/kernel-slug." />
                </div>
                <KaggleKernelPicker value={monitorSlug.trim()} onPick={setMonitorSlug} disabled={isBusy} />
                <div className="row-gap-md">
                  <input
                    id="kaggle-monitor-slug"
                    type="text"
                    className="editor-input form-control-flex"
                    placeholder="owner/kernel-slug"
                    value={monitorSlug}
                    onChange={(e) => setMonitorSlug(e.target.value)}
                  />
                  <button
                    type="button"
                    id="kaggle-monitor-btn"
                    className="btn btn-secondary btn-modal-attach"
                    onClick={handleMonitor}
                    disabled={isBusy || !isKernelSlug(monitorSlug)}
                    title="Requires a kernel reference in the form owner/kernel-slug"
                  >
                    Attach Monitor
                  </button>
                </div>
              </div>
            </div>
          ) : targetPlatform === "colab" ? (
            <div className="modal-info-card">
              <div className="modal-info-text">
                Google Colab execution mounts <strong>Google Drive FUSE</strong> directly at <code>/content/drive/MyDrive/LemGendaryModels</code>.
                Background daemon threads stream updated model weights and metrics every 30 seconds.
              </div>
              <div className="modal-info-note">
                The GUI cannot launch Colab runs: generate the training notebook from the model card and open it in Colab yourself.
              </div>
            </div>
          ) : (
            <div className="modal-info-card-lg">
              <div className="modal-info-heading">
                <h4 className="card-section-title">
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
              className="banner-space-bottom"
            />
          )}

          {/* Action Buttons */}
          <div className="modal-action-footer">
            <div className="row-gap-md">
              {kaggleLinks ? (
                <>
                  <ExternalLink
                    href={kaggleLinks.notebookUrl}
                    className="btn btn-secondary btn-modal-link"
                  >
                    Kaggle Notebook
                  </ExternalLink>
                  <ExternalLink
                    href={kaggleLinks.modelHubUrl}
                    className="btn btn-secondary btn-modal-link"
                  >
                    Kaggle Model Hub
                  </ExternalLink>
                </>
              ) : (
                <span className="modal-action-muted">Kaggle links need the model handles from the Training Suite.</span>
              )}
            </div>

            <div className="row-gap-md">
              <button
                type="button"
                className="btn btn-secondary btn-modal-cancel"
                onClick={onClose}
                disabled={isBusy || isUploading}
              >
                Cancel
              </button>

              {targetPlatform === "kaggle" && (
                <button
                  type="button"
                  className="btn btn-primary btn-modal-confirm"
                  onClick={handleLaunch}
                  disabled={isBusy || !launchFormValid}
                  title={launchFormValid ? undefined : "Fix the Advanced launch options first"}
                >
                  {isBusy ? "Dispatching..." : "Launch Cloud Training"}
                </button>
              )}

              {targetPlatform === "upload" && (
                <button
                  type="button"
                  className="btn btn-primary btn-modal-confirm"
                  onClick={handlePushModel}
                  disabled={isUploading}
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

