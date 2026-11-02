import React, { useEffect, useRef } from "react";

interface CleanInstallConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** What a clean install deletes; shown verbatim so the user knows the cost. */
export const CLEAN_INSTALL_DELETIONS: readonly string[] = [
  "The .venv virtual environment of every managed Python project (recreated from the manifests).",
  "The node_modules folder of every Node project (reinstalled with npm).",
  "Every process running from those virtual environments, including running sidecars (stopped first).",
];

/**
 * Confirmation step for the destructive pipeline run. Only the Confirm button
 * calls `onConfirm`; Escape and Cancel call `onCancel`.
 * Focus starts on Cancel so an accidental Enter does not delete anything.
 */
export const CleanInstallConfirmDialog: React.FC<CleanInstallConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div
        id="pipeline-dialog-clean-install"
        className="modal-content modal-content-compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pipeline-dialog-clean-install-title"
        aria-describedby="pipeline-dialog-clean-install-desc"
      >
        <div className="modal-header">
          <h2 id="pipeline-dialog-clean-install-title" style={{ fontSize: "18px", fontWeight: 700 }}>
            Confirm clean install
          </h2>
        </div>
        <div className="modal-body">
          <p id="pipeline-dialog-clean-install-desc" style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            A clean install deletes the following across all workspace projects, then reinstalls
            everything from scratch. This can take a long time and cannot be undone.
          </p>
          <ul className="modal-deletion-list">
            {CLEAN_INSTALL_DELETIONS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="modal-footer">
          <button
            id="pipeline-btn-clean-cancel"
            ref={cancelRef}
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            id="pipeline-btn-clean-confirm"
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
          >
            Delete and reinstall
          </button>
        </div>
      </div>
    </div>
  );
};

export default CleanInstallConfirmDialog;
