import React, { useState, useEffect, useCallback } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { Modal } from "./common/Modal";
import { ConfirmDialog } from "./common/ConfirmDialog";
import { TabItem, TabList, TabPanel } from "./common/Tabs";
import { ManifestEditorTab } from "./config/ManifestEditorTab";
import { SecretsEditorTab } from "./config/SecretsEditorTab";
import { fetchManifestRegistry, fetchSecrets } from "../api/client";
import { ManifestItem, SecretDraft } from "../api/types";
import { logger } from "../utils/logger";
import { ecosystemService, guiProjectFolder } from "../api/ecosystem";

type ConfigTab = "manifests" | "secrets";

const CONFIG_TABS: readonly TabItem<ConfigTab>[] = [
  { id: "manifests", label: "Registry Manifests", ariaLabel: "Switch to Registry Manifests editor" },
  { id: "secrets", label: "Secrets & Tokens Vault", ariaLabel: "Switch to Ecosystem Secrets & Tokens Vault" },
];

interface ConfigEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigEditorModal: React.FC<ConfigEditorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const initialSubtab = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("subtab") : null;
  const [activeTab, setActiveTab] = useState<ConfigTab>(initialSubtab === "secrets" ? "secrets" : "manifests");
  // Unsaved manifest edits live in the manifest tab; leaving the tab or closing asks first.
  const [manifestDirty, setManifestDirty] = useState<boolean>(false);
  const [pendingLeave, setPendingLeave] = useState<"close" | ConfigTab | null>(null);

  // Manifests state
  const [manifests, setManifests] = useState<ManifestItem[]>([]);
  const [selectedName, setSelectedName] = useState<string>("");

  // Secrets state
  const [secrets, setSecrets] = useState<SecretDraft[]>([]);
  const [isSecretsLoading, setIsSecretsLoading] = useState<boolean>(false);

  const loadManifestList = useCallback(async () => {
    try {
      const items = await fetchManifestRegistry();
      setManifests(items);
      // Keep the current pick when it is still listed; otherwise select the first item.
      setSelectedName((prev) => (items.some((m) => m.name === prev) ? prev : items[0]?.name ?? prev));
    } catch (err: unknown) {
      logger.warn("Manifest registry is unreachable; showing the offline manifest list", err);
      setManifests([
        { name: "unified_data.yaml", project: ecosystemService("dataset-compiler").project, format: "yaml", description: "Authoritative dataset and source repository registry.", exists: true, size_bytes: 0, path: null },
        { name: "unified_models_v2.yaml", project: ecosystemService("training-suite").project, format: "yaml", description: "Neural architecture registry and training hyperparameters.", exists: true, size_bytes: 0, path: null },
        { name: "config.yaml", project: ecosystemService("training-suite").project, format: "yaml", description: "Global training execution and hardware governor configuration.", exists: true, size_bytes: 0, path: null },
        { name: "presets.yaml", project: ecosystemService("training-suite").project, format: "yaml", description: "Canonical training and evaluation preset profiles.", exists: true, size_bytes: 0, path: null },
        { name: "runtime_env.yaml", project: ecosystemService("env-manager").project, format: "yaml", description: "Runtime platform specifications and dependency matrices.", exists: true, size_bytes: 0, path: null },
        { name: "package.json", project: guiProjectFolder(), format: "json", description: "Desktop GUI Tauri v2 and React package manifest.", exists: true, size_bytes: 0, path: null },
      ]);
      setSelectedName((prev) => prev || "unified_data.yaml");
    }
  }, []);

  const loadSecretsList = useCallback(async () => {
    setIsSecretsLoading(true);
    try {
      const data = await fetchSecrets();
      setSecrets(data);
    } catch (err: unknown) {
      logger.warn("Secrets list could not be loaded", err);
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

  const leave = (target: "close" | ConfigTab) => {
    if (target === "close") {
      setManifestDirty(false);
      onClose();
    } else {
      setActiveTab(target);
    }
  };

  /** Run a navigation that unmounts the manifest editor, asking first when it holds unsaved edits. */
  const guardedLeave = (target: "close" | ConfigTab) => {
    if (target === activeTab) return;
    if (manifestDirty && activeTab === "manifests") {
      setPendingLeave(target);
      return;
    }
    leave(target);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => guardedLeave("close")}
      id="config-editor-modal"
      title="Universal Dynamic Config & Secrets Vault"
      headerActions={
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, marginLeft: "12px" }}>
          <HelpTooltip content="Universal in-app configuration editor. Manage manifest registries, neural hyperparameters, and cloud secrets (Kaggle mandatory, Google Drive, GitHub, MT5) with live validation and atomic backup." />
          <TabList
            idPrefix="config-editor"
            label="Configuration sections"
            items={CONFIG_TABS}
            value={activeTab}
            onChange={guardedLeave}
            className="modal-tab-group"
            tabClassName={(selected) => `modal-tab-btn ${selected ? "active" : ""}`}
          />
          <HelpTooltip content="Registry Manifests: inspect and edit core YAML and JSON manifests across repositories with live syntax validation and diff preview. Secrets & Tokens Vault: manage multi-service credentials and API tokens; Kaggle is mandatory, the rest optional." />
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => guardedLeave("close")}
              aria-label="Close configuration editor modal"
            >
              Close
            </button>
            <HelpTooltip content="Dismiss the configuration editor and return to the main workspace. Unsaved manifest edits are discarded (you are asked first)." />
          </div>
        </div>
      }
    >
      <ConfirmDialog
        isOpen={pendingLeave !== null}
        id="config-dialog-discard-edits"
        title="Discard unsaved edits?"
        message={`${selectedName} has unsaved edits. ${pendingLeave === "close" ? "Closing" : "Leaving the manifest editor"} discards them.`}
        confirmLabel="Discard edits"
        onCancel={() => setPendingLeave(null)}
        onConfirm={() => {
          const target = pendingLeave;
          setPendingLeave(null);
          setManifestDirty(false);
          if (target) leave(target);
        }}
      />
      <TabPanel idPrefix="config-editor" items={CONFIG_TABS} value={activeTab} className="modal-tab-content">
        {activeTab === "manifests" ? (
          <ManifestEditorTab
            manifests={manifests}
            selectedName={selectedName}
            onSelectName={setSelectedName}
            onDirtyChange={setManifestDirty}
          />
        ) : (
          <SecretsEditorTab
            secrets={secrets}
            setSecrets={setSecrets}
            isSecretsLoading={isSecretsLoading}
          />
        )}
      </TabPanel>
    </Modal>
  );
};

export default ConfigEditorModal;
