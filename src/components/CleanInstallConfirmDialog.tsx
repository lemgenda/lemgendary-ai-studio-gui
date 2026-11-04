import React, { useRef } from "react";
import { Modal } from "./common/Modal";

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      id="pipeline-dialog-clean-install"
      title="Confirm clean install"
      className="modal-content-compact"
      describedById="pipeline-dialog-clean-install-desc"
      initialFocusRef={cancelRef}
      footer={
        <>
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
        </>
      }
    >
      <p id="pipeline-dialog-clean-install-desc" style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
        A clean install deletes the following across all workspace projects, then reinstalls
        everything from scratch. This can take a long time and cannot be undone.
      </p>
      <ul className="modal-deletion-list">
        {CLEAN_INSTALL_DELETIONS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Modal>
  );
};

export default CleanInstallConfirmDialog;
