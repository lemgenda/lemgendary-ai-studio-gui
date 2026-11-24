// @vitest-environment jsdom
import { act, useRef, useState, useEffect } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Modal } from "../common/Modal";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { CleanInstallConfirmDialog } from "../CleanInstallConfirmDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("React 19 & Toolchain Upgrade Compatibility Guard", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
  });

  it("renders React 19 RefObject with null initial value without type or DOM errors", () => {
    const TestComponent = () => {
      const cancelRef = useRef<HTMLButtonElement>(null);
      return (
        <Modal
          isOpen={true}
          onClose={() => {}}
          id="test-react19-modal"
          title="React 19 Test Modal"
          initialFocusRef={cancelRef}
        >
          <button ref={cancelRef} type="button">
            Cancel Target
          </button>
        </Modal>
      );
    };

    act(() => {
      root?.render(<TestComponent />);
    });

    expect(container?.textContent).toContain("React 19 Test Modal");
    expect(container?.textContent).toContain("Cancel Target");
  });

  it("renders ConfirmDialog and CleanInstallConfirmDialog in React 19 environment", () => {
    const onConfirm = () => {};
    const onCancel = () => {};

    act(() => {
      root?.render(
        <ConfirmDialog
          isOpen={true}
          id="test-confirm"
          title="Confirm Action"
          message="Are you sure?"
          confirmLabel="Proceed"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );
    });

    expect(container?.textContent).toContain("Confirm Action");
    expect(container?.textContent).toContain("Proceed");

    act(() => {
      root?.render(
        <CleanInstallConfirmDialog
          isOpen={true}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );
    });

    expect(container?.textContent).toContain("Confirm clean install");
    expect(container?.textContent).toContain("Cancel");
  });

  it("handles React 19 state batching and effect hooks synchronously in tests", () => {
    const StateTestComponent = () => {
      const [count, setCount] = useState(0);
      useEffect(() => {
        setCount(1);
      }, []);
      return <div id="count-val">{count}</div>;
    };

    act(() => {
      root?.render(<StateTestComponent />);
    });

    expect(container?.querySelector("#count-val")?.textContent).toBe("1");
  });
});
