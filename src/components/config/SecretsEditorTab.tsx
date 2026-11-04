import React, { useState } from "react";
import { HelpTooltip } from "../HelpTooltip";
import { ValidationBanner } from "../common/ValidationBanner";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { SecretDraft, SecretsSaveResponse } from "../../api/types";
import { fetchSecrets, saveSecrets } from "../../api/client";
import { servicePort } from "../../api/config";

export interface ServiceDefinition {
  key: string;
  name: string;
  description: string;
  mandatory: boolean;
  requiresUsername: boolean;
  requiresServer: boolean;
}

export const PREDEFINED_SERVICES: ServiceDefinition[] = [
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

/** True when the secret has a stored value or a new value waiting to be saved. */
export function secretHasValue(secret: SecretDraft): boolean {
  return secret.has_value || Boolean(secret.secret_value?.trim());
}

/** Human-readable status of a write-only secret; never shows the value itself. */
export function describeSecretStatus(secret: SecretDraft): string {
  if (secret.secret_value?.trim()) return "new value (unsaved)";
  if (!secret.has_value) return "not set";
  return secret.value_hint ? `set (••••${secret.value_hint})` : "set";
}

/** Summarise legacy credential files the server skipped or failed to write. */
export function describePropagationIssues(res: SecretsSaveResponse): string | null {
  const issues = [...(res.propagation?.failed ?? []), ...(res.propagation?.skipped ?? [])];
  if (issues.length === 0) return null;
  return issues.map((i) => `${i.path}: ${i.reason}`).join("; ");
}

interface SecretsEditorTabProps {
  secrets: SecretDraft[];
  setSecrets: React.Dispatch<React.SetStateAction<SecretDraft[]>>;
  isSecretsLoading: boolean;
}

export const SecretsEditorTab: React.FC<SecretsEditorTabProps> = ({
  secrets,
  setSecrets,
  isSecretsLoading,
}) => {
  const [isSecretsSaving, setIsSecretsSaving] = useState<boolean>(false);
  const [secretsSuccessMsg, setSecretsSuccessMsg] = useState<string | null>(null);
  /** Credential whose Delete button was pressed, waiting for confirmation. */
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [secretsErrorMsg, setSecretsErrorMsg] = useState<string | null>(null);
  const [isAddingSecret, setIsAddingSecret] = useState<boolean>(false);

  // New secret form state
  const [newService, setNewService] = useState<string>("kaggle");
  const [newLabel, setNewLabel] = useState<string>("");
  const [newUsername, setNewUsername] = useState<string>("");
  const [newSecretValue, setNewSecretValue] = useState<string>("");
  const [newServer, setNewServer] = useState<string>("");
  const [newIsDefault, setNewIsDefault] = useState<boolean>(false);

  const handleReplacementChange = (id: string, value: string) => {
    setSecrets((prev) => prev.map((s) => (s.id === id ? { ...s, secret_value: value } : s)));
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

    const newEntry: SecretDraft = {
      id: newId,
      service: newService,
      label,
      username: newUsername.trim() || undefined,
      has_value: false,
      value_hint: "",
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
    setPendingDeleteId(id);
  };

  const confirmDeleteSecret = (id: string) => {
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

    const hasKaggle = secrets.some((s) => s.service.toLowerCase() === "kaggle" && secretHasValue(s));
    if (!hasKaggle) {
      setSecretsErrorMsg("Validation failed: Kaggle API token is mandatory across the LemGendary Ecosystem.");
      setIsSecretsSaving(false);
      return;
    }

    try {
      const res = await saveSecrets(secrets);
      setSecretsSuccessMsg(res.message || "Secrets securely saved and propagated across repositories.");
      const issues = describePropagationIssues(res);
      if (issues) {
        setSecretsErrorMsg(`Some legacy credential files were not updated: ${issues}`);
      }
      // Reload the masked list so pending values are cleared from memory.
      setSecrets(await fetchSecrets());
      window.dispatchEvent(new CustomEvent("secrets-updated"));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setSecretsErrorMsg(
        `Secrets could not be saved: ${detail}. ` +
        `Check that the Environment Manager (port ${servicePort("env-manager")}) is running.`
      );
    } finally {
      setIsSecretsSaving(false);
    }
  };

  const hasKaggleConfigured = secrets.some((s) => s.service.toLowerCase() === "kaggle" && secretHasValue(s));

  const pendingDelete = secrets.find((sec) => sec.id === pendingDeleteId);

  return (
    <div className="secrets-container">
      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        id="config-dialog-delete-secret"
        title="Delete this credential?"
        message={`The ${pendingDelete?.service ?? ""} credential is removed from the list; saving the secrets then deletes it from the vault.`}
        confirmLabel="Delete credential"
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          const id = pendingDeleteId;
          setPendingDeleteId(null);
          if (id) confirmDeleteSecret(id);
        }}
      />
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
          <HelpTooltip content="Persist credentials to .secrets.yaml and update the local .kaggle_token, .kaggle_users and kaggle.json files. Stored values are never sent back to the GUI; a blank replacement field keeps the stored value." />
        </div>
      </div>

      {secretsErrorMsg && (
        <ValidationBanner
          type="error"
          message={secretsErrorMsg}
          onDismiss={() => setSecretsErrorMsg(null)}
          style={{ marginTop: "12px" }}
        />
      )}

      {secretsSuccessMsg && (
        <ValidationBanner
          type="success"
          message={secretsSuccessMsg}
          onDismiss={() => setSecretsSuccessMsg(null)}
          style={{ marginTop: "12px" }}
        />
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
                placeholder="e.g. Kaggle username or MT5 ID"
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
                      const replaceInputId = `replace-secret-${sec.id}`;
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
                              <span>Token: {describeSecretStatus(sec)}</span>
                            </div>
                            <label htmlFor={replaceInputId} style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              Replace value (leave blank to keep):
                            </label>
                            <input
                              id={replaceInputId}
                              type="password"
                              className="form-input"
                              autoComplete="new-password"
                              placeholder={sec.has_value ? "Leave blank to keep the stored value" : "Enter a value"}
                              value={sec.secret_value ?? ""}
                              onChange={(e) => handleReplacementChange(sec.id, e.target.value)}
                            />
                          </div>

                          <div className="credential-actions">
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
  );
};
