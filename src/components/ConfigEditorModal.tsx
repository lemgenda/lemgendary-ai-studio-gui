import React, { useState, useEffect, useCallback } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { ManifestEditorTab } from "./config/ManifestEditorTab";
import { SecretsEditorTab } from "./config/SecretsEditorTab";
import { fetchManifestRegistry, fetchSecrets } from "../api/client";
import { ManifestItem, SecretItem } from "../api/types";

interface ConfigEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigEditorModal: React.FC<ConfigEditorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"manifests" | "secrets">("manifests");

  // Manifests state
  const [manifests, setManifests] = useState<ManifestItem[]>([]);
  const [selectedName, setSelectedName] = useState<string>("unified_data.yaml");

  // Secrets state
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [isSecretsLoading, setIsSecretsLoading] = useState<boolean>(false);

  const loadManifestList = useCallback(async () => {
    try {
      const items = await fetchManifestRegistry();
      setManifests(items);
      if (items.length > 0 && !selectedName) {
        setSelectedName(items[0].name);
      }
    } catch {
      setManifests([
        { name: "unified_data.yaml", project: "lemgendary-datasets", format: "yaml", description: "Authoritative dataset and source repository registry.", exists: true, size_bytes: 0, path: null },
        { name: "unified_models_v2.yaml", project: "lemgendary-training-suite", format: "yaml", description: "Neural architecture registry and training hyperparameters.", exists: true, size_bytes: 0, path: null },
        { name: "config.yaml", project: "lemgendary-training-suite", format: "yaml", description: "Global training execution and hardware governor configuration.", exists: true, size_bytes: 0, path: null },
        { name: "presets.yaml", project: "lemgendary-training-suite", format: "yaml", description: "Canonical training and evaluation preset profiles.", exists: true, size_bytes: 0, path: null },
        { name: "runtime_env.yaml", project: "lemgendary-env-manager", format: "yaml", description: "Runtime platform specifications and dependency matrices.", exists: true, size_bytes: 0, path: null },
        { name: "package.json", project: "lemgendary-ai-studio-gui", format: "json", description: "Desktop GUI Tauri v2 and React package manifest.", exists: true, size_bytes: 0, path: null },
      ]);
    }
  }, [selectedName]);

  const loadSecretsList = useCallback(async () => {
    setIsSecretsLoading(true);
    try {
      const data = await fetchSecrets();
      setSecrets(data);
    } catch {
      // Secrets endpoint handled gracefully by SecretsEditorTab
    } finally {
      setIsSecretsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadManifestList();
      loadSecretsList();
    }
  }, [isOpen, loadManifestList, loadSecretsList]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="config-editor-modal-title">
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h2 id="config-editor-modal-title" style={{ fontSize: "18px", fontWeight: 700 }}>
              Universal Dynamic Config &amp; Secrets Vault
            </h2>
            <HelpTooltip content="Universal in-app configuration editor. Manage manifest registries, neural hyperparameters, and cloud secrets (Kaggle mandatory, Google Drive, GitHub, MT5) with live validation and atomic backup." />

            <div className="modal-tab-group" role="tablist">
              <button
                type="button"
                className={`modal-tab-btn ${activeTab === "manifests" ? "active" : ""}`}
                onClick={() => setActiveTab("manifests")}
                role="tab"
                aria-selected={activeTab === "manifests"}
                aria-label="Switch to Registry Manifests editor"
              >
                Registry Manifests
              </button>
              <HelpTooltip content="Inspect and edit core YAML and JSON manifests across repositories with live syntax validation and diff preview." />

              <button
                type="button"
                className={`modal-tab-btn ${activeTab === "secrets" ? "active" : ""}`}
                onClick={() => setActiveTab("secrets")}
                role="tab"
                aria-selected={activeTab === "secrets"}
                aria-label="Switch to Ecosystem Secrets & Tokens Vault"
              >
                Secrets &amp; Tokens Vault
              </button>
              <HelpTooltip content="Manage multi-service credentials and API tokens. Kaggle is mandatory; Google Drive, GitHub, Hugging Face, MetaTrader 5, and custom tokens are optional." />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              aria-label="Close configuration editor modal"
            >
              Close
            </button>
            <HelpTooltip content="Dismiss the configuration editor and return to the main workspace. Unsaved edits remain in memory." />
          </div>
        </div>

        {activeTab === "manifests" ? (
          <ManifestEditorTab
            manifests={manifests}
            selectedName={selectedName}
            onSelectName={setSelectedName}
          />
        ) : (
          <SecretsEditorTab
            secrets={secrets}
            setSecrets={setSecrets}
            isSecretsLoading={isSecretsLoading}
          />
        )}
      </div>
    </div>
  );
};

export default ConfigEditorModal;
