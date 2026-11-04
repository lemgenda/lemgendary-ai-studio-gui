import React, { useEffect, useRef } from "react";

/** Elements that take keyboard focus inside a dialog. */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Open modals, innermost last. Only the innermost modal reacts to Escape and
 * Tab, so a modal opened on top of another one (for example the screenshot
 * annotator over the bug report form) owns the keyboard until it closes.
 */
const openModalStack: symbol[] = [];

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export interface ModalProps {
  isOpen: boolean;
  /** Called on Escape and by the dialog's own close controls. */
  onClose: () => void;
  /** Id of the dialog element; the title gets `${id}-title`. */
  id: string;
  title: React.ReactNode;
  /** Extra class on the dialog box, e.g. `modal-content-compact`. */
  className?: string;
  /** Id of the element that describes the dialog (`aria-describedby`). */
  describedById?: string;
  /** Element focused on open; defaults to the first focusable element. */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Extra controls placed in the header next to the title. */
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  /** Extra attributes for the backdrop, e.g. the screenshot capture exclusion marker. */
  backdropAttributes?: Record<string, string>;
  children: React.ReactNode;
}

/**
 * Shared accessible modal: `role="dialog"`, `aria-modal`, `aria-labelledby`,
 * a Tab focus trap, Escape to close, and focus restored to the element that
 * was focused before the modal opened.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  id,
  title,
  className,
  describedById,
  initialFocusRef,
  headerActions,
  footer,
  backdropAttributes,
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const initialFocusTargetRef = useRef(initialFocusRef);
  initialFocusTargetRef.current = initialFocusRef;

  useEffect(() => {
    if (!isOpen) return;
    const token = Symbol(id);
    openModalStack.push(token);
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const dialog = dialogRef.current;
    if (dialog) {
      const target = initialFocusTargetRef.current?.current ?? focusableElements(dialog)[0] ?? dialog;
      target.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openModalStack[openModalStack.length - 1] !== token) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusables = focusableElements(dialogRef.current);
      if (focusables.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const outside = !(active instanceof Node) || !dialogRef.current.contains(active);
      if (event.shiftKey && (outside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (outside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const index = openModalStack.lastIndexOf(token);
      if (index >= 0) openModalStack.splice(index, 1);
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, id]);

  if (!isOpen) return null;

  const titleId = `${id}-title`;
  return (
    <div className="modal-backdrop" {...backdropAttributes}>
      <div
        id={id}
        ref={dialogRef}
        className={className ? `modal-content ${className}` : "modal-content"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedById}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          {headerActions}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
