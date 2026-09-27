import React, { useState, useEffect, useCallback } from "react";
import { HelpTooltip } from "./HelpTooltip";
import {
  fetchManifestRegistry,
  readManifest,
  validateManifest,
  saveManifest,
  fetchSecrets,
  saveSecrets,
} from "../api/client";
import { ManifestItem, SecretItem } from "../api/types";

interface ConfigEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ServiceDefinition {
  key: string;
  name: string;
  description: string;
  mandatory: boolean;
  requiresUsername: boolean;
  requiresServer: boolean;
}

const PREDEFINED_SERVICES: ServiceDefinition[] = [
  {
    key: "kaggle",
    name: "Kaggle",
    description: "Mandatory credentials for downloading raw datasets and publishing compiled manifolds and model checkpoints.",
    mandatory: true,
    requiresUsername: true,
    requiresServer: false,
  },
  {
    key: "google_drive",
    name: "Google Drive",
    description: "Optional cloud backup and checkpoint synchronization for multi-GPU training clusters.",
    mandatory: false,
    requiresUsername: true,
    requiresServer: false,
  },
  {
    key: "github",
    name: "GitHub",
    description: "Personal Access Token for repository synchronization and whitepaper deployment.",
    mandatory: false,
    requiresUsername: true,
    requiresServer: false,
  },
  {
    key: "huggingface",
    name: "Hugging Face",
    description: "Hub API token for downloading foundation models and uploading PyTorch checkpoints.",
    mandatory: false,
    requiresUsername: true,
    requiresServer: false,
  },
  {
    key: "metatrader5",
    name: "MetaTrader 5",
    description: "Broker credentials and demo/live terminal server configuration for algorithmic forex data streaming.",
    mandatory: false,
    requiresUsername: true,
    requiresServer: true,
  },
  {
    key: "saturn_cloud",
    name: "Saturn Cloud",
    description: "High-performance cluster API bearer token for distributed model training jobs.",
    mandatory: false,
    requiresUsername: false,
    requiresServer: false,
  },
  {
    key: "wandb",
    name: "Weights & Biases",
    description: "Experiment tracking and cloud loss curve visualization API key.",
    mandatory: false,
    requiresUsername: true,
    requiresServer: false,
  },
  {
    key: "custom",
    name: "Custom Service",
    description: "User-defined secrets, webhook tokens, and external API credentials.",
    mandatory: false,
    requiresUsername: true,
    requiresServer: false,
  },
];

export const ConfigEditorModal: React.FC<ConfigEditorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"manifests" | "secrets">("manifests");

  // Manifests state
  const [manifests, setManifests] = useState<ManifestItem[]>([]);
  const [selectedName, setSelectedName] = useState<string>("unified_data.yaml");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [currentContent, setCurrentContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [showDiff, setShowDiff] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Secrets state
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [isSecretsLoading, setIsSecretsLoading] = useState<boolean>(false);
  const [isSecretsSaving, setIsSecretsSaving] = useState<boolean>(false);
  const [secretsSuccessMsg, setSecretsSuccessMsg] = useState<string | null>(null);
  const [secretsErrorMsg, setSecretsErrorMsg] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [isAddingSecret, setIsAddingSecret] = useState<boolean>(false);

  // New secret form state
  const [newService, setNewService] = useState<string>("kaggle");
  const [newLabel, setNewLabel] = useState<string>("");
  const [newUsername, setNewUsername] = useState<string>("");
  const [newSecretValue, setNewSecretValue] = useState<string>("");
  const [newServer, setNewServer] = useState<string>("");
  const [newIsDefault, setNewIsDefault] = useState<boolean>(false);

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

  const loadFileContent = useCallback(async (name: string) => {
    setIsLoading(true);
    setValidationResult(null);
    setSaveSuccessMsg(null);
    setShowDiff(false);
    try {
      const res = await readManifest(name);
      setOriginalContent(res.content);
      setCurrentContent(res.content);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load manifest content";
      setOriginalContent(`# Error loading manifest:\n# ${msg}`);
      setCurrentContent(`# Error loading manifest:\n# ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadSecretsList = useCallback(async () => {
    setIsSecretsLoading(true);
    setSecretsErrorMsg(null);
    try {
      const data = await fetchSecrets();
      setSecrets(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed loading secrets";
      setSecretsErrorMsg(msg);
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

  useEffect(() => {
    if (isOpen && selectedName && activeTab === "manifests") {
      loadFileContent(selectedName);
    }
  }, [isOpen, selectedName, activeTab, loadFileContent]);

  if (!isOpen) return null;

  // Manifest actions
  const handleValidate = async () => {
    try {
      const res = await validateManifest(selectedName, currentContent);
      if (res.valid) {
        setValidationResult({ valid: true, message: "Valid syntax: Document parsed successfully without errors." });
      } else {
        setValidationResult({ valid: false, message: `Syntax Error: ${res.error || "Malformed structure."}` });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Validation call failed";
      setValidationResult({ valid: false, message: `Validation failed: ${msg}` });
    }
  };

  const handleSaveManifest = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);
    try {
      const res = await saveManifest(selectedName, currentContent);
      setOriginalContent(currentContent);
      setShowDiff(false);
      setSaveSuccessMsg(`Manifest ${res.name} saved successfully (${res.bytes_written.toLocaleString()} bytes written).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save manifest";
      setValidationResult({ valid: false, message: `Save error: ${msg}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = () => {
    setCurrentContent(originalContent);
    setShowDiff(false);
    setValidationResult(null);
    setSaveSuccessMsg(null);
  };

  // Secrets actions
  const toggleSecretVisibility = (id: string) => {
    setRevealedSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddSecretSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecretValue.trim()) {
      setSecretsErrorMsg("Secret token or password cannot be empty.");
      return;
    }

    const targetServiceDef = PREDEFINED_SERVICES.find((s) => s.key === newService);
    if (targetServiceDef?.requiresUsername && !newUsername.trim()) {
      setSecretsErrorMsg(`Username is required for ${targetServiceDef.name}.`);
      return;
    }

    const newId = `${newService}-${Date.now().toString(36)}`;
    const label = newLabel.trim() || `${targetServiceDef?.name || newService} (${newUsername.trim() || "Account"})`;

    const updated = secrets.map((s) => {
      if (newIsDefault && s.service === newService) {
        return { ...s, is_default: false };
      }
      return s;
    });

    const newEntry: SecretItem = {
      id: newId,
      service: newService,
      label,
      username: newUsername.trim() || undefined,
      secret_value: newSecretValue.trim(),
      server: newServer.trim() || undefined,
      is_default: newIsDefault || !secrets.some((s) => s.service === newService),
      created_at: new Date().toISOString(),
    };

    setSecrets([...updated, newEntry]);
    setIsAddingSecret(false);
    setNewLabel("");
    setNewUsername("");
    setNewSecretValue("");
    setNewServer("");
    setNewIsDefault(false);
    setSecretsErrorMsg(null);
    setSecretsSuccessMsg("New credential added to queue. Click 'Save Secrets to Ecosystem' to persist.");
  };

  const handleDeleteSecret = (id: string) => {
    const remaining = secrets.filter((s) => s.id !== id);
    setSecrets(remaining);
    setSecretsSuccessMsg("Credential removed. Click 'Save Secrets to Ecosystem' to persist changes.");
  };

  const handleSetDefault = (id: string, service: string) => {
    const updated = secrets.map((s) => {
      if (s.service === service) {
        return { ...s, is_default: s.id === id };
      }
      return s;
    });
    setSecrets(updated);
    setSecretsSuccessMsg(`Default account for ${service} updated.`);
  };

  const handleSaveSecretsToDisk = async () => {
    setIsSecretsSaving(true);
    setSecretsErrorMsg(null);
    setSecretsSuccessMsg(null);

    const hasKaggle = secrets.some((s) => s.service.toLowerCase() === "kaggle" && s.secret_value.trim());
    if (!hasKaggle) {
      setSecretsErrorMsg("Validation failed: Kaggle API token is mandatory across the LemGendary Ecosystem.");
      setIsSecretsSaving(false);
      return;
    }

    try {
      const res = await saveSecrets(secrets);
      setSecretsSuccessMsg(res.message || "Secrets securely saved and propagated across repositories.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to persist secrets";
      setSecretsErrorMsg(msg);
    } finally {
      setIsSecretsSaving(false);
    }
  };

  const isModified = originalContent !== currentContent;
  const hasKaggleConfigured = secrets.some((s) => s.service.toLowerCase() === "kaggle" && s.secret_value.trim());

  const computeDiffLines = () => {
    const origLines = originalContent.split("\n");
    const currLines = currentContent.split("\n");
    const diffs: { type: "same" | "add" | "del"; line: string; num: number }[] = [];
    const maxLen = Math.max(origLines.length, currLines.length);

    for (let i = 0; i < maxLen; i++) {
      const o = origLines[i];
      const c = currLines[i];
      if (o === c && o !== undefined) {
        diffs.push({ type: "same", line: o, num: i + 1 });
      } else {
        if (o !== undefined) {
          diffs.push({ type: "del", line: o, num: i + 1 });
        }
        if (c !== undefined) {
          diffs.push({ type: "add", line: c, num: i + 1 });
        }
      }
    }
    return diffs;
  };

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
          <div className="modal-body">
            <div className="editor-toolbar">
              <div className="editor-control-group">
                <label htmlFor="manifest-select" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Target Manifest:
                </label>
                <select
                  id="manifest-select"
                  className="editor-select"
                  value={selectedName}
                  onChange={(e) => setSelectedName(e.target.value)}
                  disabled={isLoading || isSaving}
                  aria-label="Select manifest file to inspect and edit"
                >
                  {manifests.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name} ({m.project} - {m.format.toUpperCase()})
                    </option>
                  ))}
                </select>
                <HelpTooltip content="Select which manifest to load. Covers unified_data.yaml, unified_models_v2.yaml, config.yaml, presets.yaml, runtime_env.yaml, and dependency manifests." />
              </div>

              <div className="editor-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleValidate}
                  disabled={isLoading || isSaving}
                  aria-label="Validate syntax of current document"
                >
                  Validate Syntax
                </button>
                <HelpTooltip content="Check syntax in real-time. Parses YAML indentation or JSON structure and alerts if errors exist." />

                <button
                  type="button"
                  className={`btn ${showDiff ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setShowDiff(!showDiff)}
                  disabled={isLoading || isSaving || !isModified}
                  aria-label="Toggle diff preview between disk version and current edits"
                >
                  {showDiff ? "Hide Diff" : "Preview Diff"}
                </button>
                <HelpTooltip content="Compare your pending edits against the version currently saved on disk, highlighting additions and deletions." />

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleRevert}
                  disabled={isLoading || isSaving || !isModified}
                  aria-label="Revert pending edits to disk version"
                >
                  Revert
                </button>
                <HelpTooltip content="Discard all unsaved edits and restore the exact content currently stored on disk." />

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveManifest}
                  disabled={isLoading || isSaving || !isModified}
                  aria-label="Save changes to disk with atomic backup"
                >
                  {isSaving ? "Saving..." : "Save Manifest"}
                </button>
                <HelpTooltip content="Commit changes to disk. Creates an automatic .bak snapshot before atomically writing the file." />
              </div>
            </div>

            {validationResult && (
              <div
                className={`validation-banner ${validationResult.valid ? "banner-success" : "banner-error"}`}
                role="alert"
              >
                <span>{validationResult.message}</span>
              </div>
            )}

            {saveSuccessMsg && (
              <div className="validation-banner banner-success" role="status">
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {showDiff ? (
              <div className="diff-view-container" role="region" aria-label="Visual diff comparison">
                {computeDiffLines().map((item, idx) => (
                  <div key={idx} className={`diff-line diff-${item.type}`}>
                    <span className="diff-line-num">{item.num}</span>
                    <span className="diff-line-prefix">
                      {item.type === "add" ? "+" : item.type === "del" ? "-" : " "}
                    </span>
                    <span className="diff-line-text">{item.line}</span>
                  </div>
                ))}
              </div>
            ) : (
              <textarea
                className="editor-textarea"
                value={currentContent}
                onChange={(e) => setCurrentContent(e.target.value)}
                disabled={isLoading || isSaving}
                aria-label={`Editing text content for manifest ${selectedName}`}
                spellCheck={false}
              />
            )}
          </div>
        ) : (
          <div className="secrets-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span className={`service-badge ${hasKaggleConfigured ? "badge-mandatory" : "badge-error"}`}>
                  {hasKaggleConfigured ? "Kaggle Authenticated (Mandatory)" : "Kaggle API Key Missing (Required)"}
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {secrets.length} active credentials registered
                </span>
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddingSecret(!isAddingSecret)}
                  aria-label="Toggle add new secret form"
                >
                  {isAddingSecret ? "Cancel" : "+ Add New Secret"}
                </button>
                <HelpTooltip content="Register a new secret token or account credential for Kaggle, Google Drive, GitHub, Hugging Face, or MetaTrader 5." />

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveSecretsToDisk}
                  disabled={isSecretsSaving}
                  aria-label="Save all secrets and sync across repositories"
                >
                  {isSecretsSaving ? "Saving..." : "Save Secrets to Ecosystem"}
                </button>
                <HelpTooltip content="Persist credentials to encrypted .secrets.yaml and automatically update local .kaggle_token, .kaggle_users, and .mt5_credentials files." />
              </div>
            </div>

            {secretsErrorMsg && (
              <div className="validation-banner banner-error" role="alert">
                <span>{secretsErrorMsg}</span>
              </div>
            )}

            {secretsSuccessMsg && (
              <div className="validation-banner banner-success" role="status">
                <span>{secretsSuccessMsg}</span>
              </div>
            )}

            {isAddingSecret && (
              <form className="secret-form-card" onSubmit={handleAddSecretSubmit}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>Add New Credential / Token</h4>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Multiple secrets allowed per service</span>
                </div>

                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="new-service-select">Target Service:</label>
                    <select
                      id="new-service-select"
                      className="form-input"
                      value={newService}
                      onChange={(e) => setNewService(e.target.value)}
                    >
                      {PREDEFINED_SERVICES.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.name} {s.mandatory ? "(MANDATORY)" : "(Optional)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="new-label-input">Label / Description:</label>
                    <input
                      id="new-label-input"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Primary Production Key"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="new-username-input">Username / Account ID:</label>
                    <input
                      id="new-username-input"
                      type="text"
                      className="form-input"
                      placeholder="e.g. lemtreursi or MT5 ID"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                    />
                  </div>

                  {newService === "metatrader5" && (
                    <div className="form-field">
                      <label htmlFor="new-server-input">Broker Server:</label>
                      <input
                        id="new-server-input"
                        type="text"
                        className="form-input"
                        placeholder="e.g. MetaQuotes-Demo"
                        value={newServer}
                        onChange={(e) => setNewServer(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor="new-secret-input">Secret Token / API Key / Password:</label>
                    <input
                      id="new-secret-input"
                      type="password"
                      className="form-input"
                      placeholder="Paste API token, bearer token, or password"
                      value={newSecretValue}
                      onChange={(e) => setNewSecretValue(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={newIsDefault}
                      onChange={(e) => setNewIsDefault(e.target.checked)}
                    />
                    Set as default active credential for this service
                  </label>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setIsAddingSecret(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Add to Vault
                    </button>
                  </div>
                </div>
              </form>
            )}

            {isSecretsLoading ? (
              <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
                Loading ecosystem secrets vault...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {PREDEFINED_SERVICES.map((def) => {
                  const serviceSecrets = secrets.filter((s) => s.service.toLowerCase() === def.key.toLowerCase());
                  return (
                    <div key={def.key} className="service-card">
                      <div className="service-card-header">
                        <div className="service-title-group">
                          <span className="service-name">{def.name}</span>
                          <span className={`service-badge ${def.mandatory ? "badge-mandatory" : "badge-optional"}`}>
                            {def.mandatory ? "Mandatory" : "Optional"}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            ({serviceSecrets.length} configured)
                          </span>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={() => {
                            setNewService(def.key);
                            setIsAddingSecret(true);
                          }}
                          aria-label={`Add new credential for ${def.name}`}
                        >
                          + Add {def.name} Secret
                        </button>
                      </div>

                      <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)" }}>
                        {def.description}
                      </p>

                      {serviceSecrets.length === 0 ? (
                        <div style={{ padding: "10px 14px", backgroundColor: "rgba(15, 23, 42, 0.4)", borderRadius: "var(--radius-sm)", fontSize: "12px", color: "var(--text-muted)" }}>
                          No credentials configured for {def.name}. {def.mandatory ? "Please add at least one account to allow cloud data synchronization." : "Add a credential if you plan to use this integration."}
                        </div>
                      ) : (
                        <div className="credentials-list">
                          {serviceSecrets.map((sec) => {
                            const isRevealed = revealedSecrets[sec.id] || false;
                            const masked = sec.secret_value.length > 8
                              ? `${sec.secret_value.slice(0, 4)}••••••••${sec.secret_value.slice(-4)}`
                              : "••••••••";

                            return (
                              <div key={sec.id} className="credential-item">
                                <div className="credential-meta">
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span className="credential-label">{sec.label}</span>
                                    {sec.is_default && (
                                      <span style={{ fontSize: "10px", background: "rgba(16, 185, 129, 0.2)", color: "#10b981", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                                        DEFAULT
                                      </span>
                                    )}
                                  </div>
                                  <div className="credential-details">
                                    {sec.username && <span>User: {sec.username}</span>}
                                    {sec.server && <span>Server: {sec.server}</span>}
                                    <span>Token: {isRevealed ? sec.secret_value : masked}</span>
                                  </div>
                                </div>

                                <div className="credential-actions">
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ padding: "4px 8px", fontSize: "11px" }}
                                    onClick={() => toggleSecretVisibility(sec.id)}
                                    aria-label={isRevealed ? "Hide token value" : "Reveal token value"}
                                  >
                                    {isRevealed ? "Hide" : "Show"}
                                  </button>
                                  <HelpTooltip content="Toggle plain-text view of this secret token." />

                                  {!sec.is_default && (
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      style={{ padding: "4px 8px", fontSize: "11px" }}
                                      onClick={() => handleSetDefault(sec.id, sec.service)}
                                      aria-label="Set as default active credential"
                                    >
                                      Make Default
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    className="btn btn-danger"
                                    style={{ padding: "4px 8px", fontSize: "11px" }}
                                    onClick={() => handleDeleteSecret(sec.id)}
                                    aria-label="Delete this credential"
                                  >
                                    Delete
                                  </button>
                                  <HelpTooltip content="Remove this credential entry from the vault." />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfigEditorModal;
