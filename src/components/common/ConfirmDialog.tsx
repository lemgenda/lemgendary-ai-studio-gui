/**
 * LemGendary AI Studio - confirmation step for a destructive or lossy action.
 *
 * Only the confirm button calls `onConfirm`; Escape and Cancel call
 * `onCancel`. Focus starts on Cancel so an accidental Enter changes nothing.
 */

import React, { useRef } from "react";
import { Modal } from "./Modal";

export interface ConfirmDialogProps {
  isOpen: boolean;
  /** Dialog id; the buttons get `${id}-cancel` and `${id}-confirm`. */
  id: string;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  id,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const descId = `${id}-desc`;
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      id={id}
      title={title}
      className="modal-content-compact"
      describedById={descId}
      initialFocusRef={cancelRef}
      footer={
        <>
          <button id={`${id}-cancel`} ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button id={`${id}-confirm`} type="button" className="btn btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div id={descId} style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
        {message}
      </div>
    </Modal>
  );
};
