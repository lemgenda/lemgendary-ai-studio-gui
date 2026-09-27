import React, { useState, useEffect, useCallback } from "react";
import { HelpTooltip } from "./HelpTooltip";
import {
  fetchManifestRegistry,
  readManifest,
  validateManifest,
  saveManifest,
} from "../api/client";
import { ManifestItem } from "../api/types";

interface ConfigEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigEditorModal: React.FC<ConfigEditorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [manifests, setManifests] = useState<ManifestItem[]>([]);
  const [selectedName, setSelectedName] = useState<string>("unified_data.yaml");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [currentContent, setCurrentContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [showDiff, setShowDiff] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const loadManifestList = useCallback(async () => {
    try {
      const items = await fetchManifestRegistry();
      setManifests(items);
      if (items.length > 0 && !selectedName) {
        setSelectedName(items[0].name);
      }
    } catch {
      // Fallback defaults
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

  useEffect(() => {
    if (isOpen) {
      loadManifestList();
    }
  }, [isOpen, loadManifestList]);

  useEffect(() => {
    if (isOpen && selectedName) {
      loadFileContent(selectedName);
    }
  }, [isOpen, selectedName, loadFileContent]);

  if (!isOpen) return null;

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

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);
    try {
      const res = await saveManifest(selectedName, currentContent);
      setOriginalContent(currentContent);
      setSaveSuccessMsg(`Successfully saved ${res.bytes_written} bytes. Atomic backup created as .bak.`);
      setValidationResult(null);
      setShowDiff(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save manifest";
      setValidationResult({ valid: false, message: `Save rejected: ${msg}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = () => {
    setCurrentContent(originalContent);
    setValidationResult(null);
    setSaveSuccessMsg("Reverted to saved disk version.");
    setShowDiff(false);
  };

  const computeDiffLines = () => {
    const origLines = originalContent.split("\n");
    const currLines = currentContent.split("\n");
    const maxLen = Math.max(origLines.length, currLines.length);
    const diff: Array<{ type: "add" | "del" | "same"; line: string; num: number }> = [];

    for (let i = 0; i < maxLen; i++) {
      const orig = origLines[i];
      const curr = currLines[i];
      if (orig === curr) {
        if (orig !== undefined) {
          diff.push({ type: "same", line: orig, num: i + 1 });
        }
      } else {
        if (orig !== undefined) {
          diff.push({ type: "del", line: orig, num: i + 1 });
        }
        if (curr !== undefined) {
          diff.push({ type: "add", line: curr, num: i + 1 });
        }
      }
    }
    return diff;
  };

  const isModified = currentContent !== originalContent;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="config-editor-modal-title">
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h2 id="config-editor-modal-title" style={{ fontSize: "18px", fontWeight: 700 }}>
              Universal Dynamic Config &amp; Registry Editor
            </h2>
            <HelpTooltip content="Universal in-app configuration editor. Modify dataset registries, neural models, hyperparameters, and environment requirements with atomic backup protection and live syntax validation." />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {isModified ? "Unsaved changes" : "Synced with disk"}
            </span>
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
                onClick={handleSave}
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
      </div>
    </div>
  );
};

export default ConfigEditorModal;
