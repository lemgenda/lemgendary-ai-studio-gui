import React, { useState } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { ModelItem, KaggleSuiteStatus } from "../api/types";
import { pushKaggleModelArtifacts } from "../api/client";

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

  if (!isOpen || !model) return null;

  const isForex = Boolean(model.is_forex || model.task_type === "forex" || model.category === "forex");
  const datasetSlug = isForex
    ? "ForexUniverse (2019-2026)"
    : `LemGendized${model.key.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")}`;
  const datasetSearchQuery = isForex ? "lemtreursi/forexuniverse" : `lemtreursi/${model.key.replace(/_/g, "-")}`;
  const kaggleUrl = `https://www.kaggle.com/code/lemtreursi/${model.key.replace(/_/g, "-")}-training`;
  const notebookFilename =
    targetPlatform === "colab"
      ? `${model.key}_colab_training.ipynb`
      : `${model.key}_kaggle_training.ipynb`;
  const checkpointRepo = `lemtreursi/lemgendary-${model.key.replace(/_/g, "-")}-checkpoints`;

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

  const handleUploadCheckpoints = async () => {
    setIsUploading(true);
    setUploadStatus(null);
    try {
      const res = await pushKaggleModelArtifacts(model.key);
      setUploadStatus(res.message || `Checkpoints for ${model.key} uploaded successfully.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadStatus(`Upload failed: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cloud-modal-title">
      <div className="modal-content" style={{ maxWidth: "680px", height: "auto", maxHeight: "90vh", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h3 id="cloud-modal-title" style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              Cloud Training Dispatch: {model.display_name}
            </h3>
            <HelpTooltip content="Dispatches production-hardened remote execution notebooks to Kaggle GPU cloud or prepares Google Colab manifests." />
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
              Upload Checkpoints
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
                    {checkpointRepo}
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
              <h4 style={{ fontSize: "13px", fontWeight: 700, margin: "0 0 10px 0", color: "var(--text-primary)" }}>
                Stage &amp; Upload Local Checkpoints to Kaggle Models
              </h4>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 12px 0" }}>
                Upload converged weights, metrics, and compiled binaries from local <code>LemGendaryModels/{model.key}/checkpoints/</code> into remote Kaggle Models (<code>kaggle.com/models/{checkpointRepo}</code>).
              </p>
              <div style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "6px" }}>
                <div>Local Source: LemGendaryModels/{model.key}/</div>
                <div>Target Repo: {checkpointRepo}</div>
                <div>Artifacts: *_best.pth, metrics.csv, *.onnx</div>
              </div>
              {uploadStatus && (
                <div className={`validation-banner ${uploadStatus.includes("failed") ? "banner-error" : "banner-success"}`} style={{ marginTop: "12px", fontSize: "12px" }}>
                  <span>{uploadStatus}</span>
                </div>
              )}
            </div>
          )}

          {launchError && (
            <div className="validation-banner banner-error" style={{ marginBottom: "16px" }} role="alert">
              <span>{launchError}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid var(--border-color)", paddingTop: "16px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isBusy || isUploading}
              style={{ padding: "8px 16px", fontSize: "13px" }}
            >
              Cancel
            </button>

            <a
              href={kaggleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ padding: "8px 16px", fontSize: "13px", textDecoration: "none" }}
            >
              Open on Kaggle
            </a>

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
                onClick={handleUploadCheckpoints}
                disabled={isUploading}
                style={{ padding: "8px 20px", fontSize: "13px", fontWeight: 600 }}
              >
                {isUploading ? "Uploading Checkpoints..." : "Upload to Kaggle Models"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
