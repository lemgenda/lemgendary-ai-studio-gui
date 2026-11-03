// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "../Header";
import { TestModal } from "../TestModal";
import testModalSource from "../TestModal.tsx?raw";
import { MESH_SERVICES } from "../../api/client";

// Tell React this is a test environment so act() flushes updates synchronously.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Mirrors the App wiring: modal state lives in the shell, the header opens it. */
const Shell: React.FC = () => {
  const [isTestModalOpen, setIsTestModalOpen] = useState<boolean>(false);
  return (
    <>
      <Header
        title="Dashboard"
        onRefresh={() => undefined}
        isRefreshing={false}
        onOpenTestModal={() => setIsTestModalOpen(true)}
        envManagerOnline={true}
      />
      <TestModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        trainingSuiteOnline={true}
        datasetCompilerOnline={true}
      />
    </>
  );
};

describe("Test & Diagnostic modal", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // A fresh Response per call: the header's docs-status request also consumes one.
    fetchMock = vi.fn().mockImplementation(async () =>
      new Response(
        JSON.stringify({ status: "failed", tests_run: 3, failures_count: 1, errors_count: 0 })
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<Shell />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const openModal = () => {
    const button = container.querySelector<HTMLButtonElement>("#header-btn-test-modal");
    expect(button).not.toBeNull();
    act(() => {
      button?.click();
    });
  };

  it("opens from the header button as a labelled modal dialog", () => {
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    openModal();
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    const titleId = dialog?.getAttribute("aria-labelledby") ?? "";
    expect(container.querySelector(`#${titleId}`)?.textContent).toContain("Test & Diagnostic");
  });

  it("closes on Escape", () => {
    openModal();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("runs training unit tests through the mesh base URL and tolerates missing arrays", async () => {
    openModal();
    act(() => {
      container.querySelector<HTMLButtonElement>("#test-modal-tab-training")?.click();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>("#test-modal-btn-run-training-unit")?.click();
    });
    // The header also asks the Environment Manager for the docs hub status on mount.
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
      `${MESH_SERVICES["training-suite"].httpUrl}/api/training/unit-test-run`
    );
    const output = container.querySelector("#test-modal-output-console")?.textContent ?? "";
    expect(output).toContain("[FAIL] 1 failures, 0 errors across 3 tests.");
    expect(output).toContain("Failing tests: none reported");
  });

  it("contains no literal sidecar URLs or ports", () => {
    expect(testModalSource).not.toMatch(/https?:\/\//);
    for (const service of Object.values(MESH_SERVICES)) {
      expect(testModalSource).not.toMatch(new RegExp(`\\b${service.defaultPort}\\b`));
    }
    expect(testModalSource).not.toContain("sidecarFetch");
  });
});
