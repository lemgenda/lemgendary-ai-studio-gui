import React, { useState, useEffect, useCallback } from "react";
import { HelpTooltip } from "../HelpTooltip";
import { ValidationBanner } from "../common/ValidationBanner";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { readManifest, validateManifest, saveManifest } from "../../api/client";
import { ManifestItem } from "../../api/types";
import { servicePort } from "../../api/config";

interface ManifestEditorTabProps {
  manifests: ManifestItem[];
  /** Why the manifest registry could not be loaded (Environment Manager offline); null when it loaded. */
  registryError?: string | null;
  selectedName: string;
  onSelectName: (name: string) => void;
  /** Reports whether the editor holds unsaved edits, so the modal can confirm before discarding them. */
  onDirtyChange?: (dirty: boolean) => void;
}

export const ManifestEditorTab: React.FC<ManifestEditorTabProps> = ({
  manifests,
  registryError = null,
  selectedName,
  onSelectName,
  onDirtyChange,
}) => {
  /** Manifest the user picked while edits were unsaved; switching waits for confirmation. */
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState<string>("");
  const [currentContent, setCurrentContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [showDiff, setShowDiff] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  /** Why the selected manifest could not be read; the editor stays empty and read-only while set. */
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadFileContent = useCallback(async (name: string) => {
    setIsLoading(true);
    setValidationResult(null);
    setSaveSuccessMsg(null);
    setShowDiff(false);
    setLoadError(null);
    try {
      const res = await readManifest(name);
      setOriginalContent(res.content);
      setCurrentContent(res.content);
    } catch (err: unknown) {
      // Keep the editor empty: error text in the buffer would be valid YAML that Save could write.
      setOriginalContent("");
      setCurrentContent("");
      setLoadError(err instanceof Error ? err.message : "Failed to load manifest content");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedName) {
      loadFileContent(selectedName);
    }
  }, [selectedName, loadFileContent]);

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

  const isModified = originalContent !== currentContent;
  const registryOffline = registryError !== null || manifests.length === 0;
  /** Validate and Save need a reachable registry and a manifest that was read successfully. */
  const editingBlocked = registryOffline || loadError !== null;

  useEffect(() => {
    onDirtyChange?.(isModified);
  }, [isModified, onDirtyChange]);

  const handleSelectName = (name: string) => {
    if (name === selectedName) return;
    if (isModified) {
      setPendingName(name);
      return;
    }
    onSelectName(name);
  };

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
    <div className="modal-tab-content">
      <ConfirmDialog
        isOpen={pendingName !== null}
        id="config-dialog-discard-manifest"
        title="Discard unsaved edits?"
        message={`${selectedName} has unsaved edits. Switching to ${pendingName ?? ""} discards them.`}
        confirmLabel="Discard and switch"
        onCancel={() => setPendingName(null)}
        onConfirm={() => {
          const next = pendingName;
          setPendingName(null);
          if (next) onSelectName(next);
        }}
      />
      {/* Offline banner */}
      {registryOffline && (
        <ValidationBanner
          type="error"
          message={`Manifest registry is unavailable (Port ${servicePort("env-manager")} offline${registryError ? `: ${registryError}` : ""}). Start the Environment Manager to view and edit manifests.`}
          style={{ marginBottom: "12px" }}
        />
      )}
      {!registryOffline && loadError !== null && (
        <ValidationBanner
          type="error"
          message={`Could not load ${selectedName}: ${loadError}. Validate and Save stay disabled until the manifest loads.`}
          style={{ marginBottom: "12px" }}
        />
      )}

      <div className="editor-toolbar">
        <div className="editor-control-group">
          <label htmlFor="manifest-select" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Target Manifest:
          </label>
          <select
            id="manifest-select"
            className="editor-select"
            value={selectedName}
            onChange={(e) => handleSelectName(e.target.value)}
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
            disabled={isLoading || isSaving || editingBlocked}
            aria-label="Validate syntax of current document"
            aria-disabled={editingBlocked}
          >
            Validate Syntax
          </button>
          <HelpTooltip
            content={
              editingBlocked
                ? `Validation requires Environment Manager (Port ${servicePort("env-manager")}) to be online and the manifest to load.`
                : "Check syntax in real-time. Parses YAML indentation or JSON structure and alerts if errors exist."
            }
          />

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
            disabled={isLoading || isSaving || !isModified || editingBlocked}
            aria-label="Save changes to disk with atomic backup"
            aria-disabled={editingBlocked}
          >
            {isSaving ? "Saving..." : "Save Manifest"}
          </button>
          <HelpTooltip
            content={
              editingBlocked
                ? `Save requires Environment Manager (Port ${servicePort("env-manager")}) to be online and the manifest to load.`
                : "Commit changes to disk. Creates an automatic .bak snapshot before atomically writing the file."
            }
          />
        </div>
      </div>

      {validationResult && (
        <ValidationBanner
          type={validationResult.valid ? "success" : "error"}
          message={validationResult.message}
          style={{ marginBottom: "12px" }}
        />
      )}

      {saveSuccessMsg && (
        <ValidationBanner
          type="success"
          message={saveSuccessMsg}
          onDismiss={() => setSaveSuccessMsg(null)}
          style={{ marginBottom: "12px" }}
        />
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
          disabled={isLoading || isSaving || editingBlocked}
          aria-label={`Editing text content for manifest ${selectedName}`}
          spellCheck={false}
        />
      )}
    </div>
  );
};
