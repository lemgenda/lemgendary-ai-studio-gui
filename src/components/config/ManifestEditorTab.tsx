import React, { useState, useEffect, useCallback } from "react";
import { HelpTooltip } from "../HelpTooltip";
import { ValidationBanner } from "../common/ValidationBanner";
import { readManifest, validateManifest, saveManifest } from "../../api/client";
import { ManifestItem } from "../../api/types";

interface ManifestEditorTabProps {
  manifests: ManifestItem[];
  selectedName: string;
  onSelectName: (name: string) => void;
}

export const ManifestEditorTab: React.FC<ManifestEditorTabProps> = ({
  manifests,
  selectedName,
  onSelectName,
}) => {
  const [originalContent, setOriginalContent] = useState<string>("");
  const [currentContent, setCurrentContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [showDiff, setShowDiff] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

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
    <div className="modal-body">
      {/* Offline banner */}
      {manifests.length === 0 && (
        <ValidationBanner
          type="error"
          message="Manifest registry is unavailable (Port 8000 offline). Manifests can be edited directly in the workspace filesystem when the sidecar is running."
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
            onChange={(e) => onSelectName(e.target.value)}
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
            disabled={isLoading || isSaving || manifests.length === 0}
            aria-label="Validate syntax of current document"
            aria-disabled={manifests.length === 0}
          >
            Validate Syntax
          </button>
          <HelpTooltip
            content={
              manifests.length === 0
                ? "Validation requires Environment Manager (Port 8000) to be online."
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
            disabled={isLoading || isSaving || !isModified || manifests.length === 0}
            aria-label="Save changes to disk with atomic backup"
            aria-disabled={manifests.length === 0}
          >
            {isSaving ? "Saving..." : "Save Manifest"}
          </button>
          <HelpTooltip
            content={
              manifests.length === 0
                ? "Save requires Environment Manager (Port 8000) to be online."
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
          disabled={isLoading || isSaving}
          aria-label={`Editing text content for manifest ${selectedName}`}
          spellCheck={false}
        />
      )}
    </div>
  );
};
