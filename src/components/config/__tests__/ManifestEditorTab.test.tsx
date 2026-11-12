// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManifestEditorTab } from "../ManifestEditorTab";
import { ManifestItem } from "../../../api/types";
import * as client from "../../../api/client";

vi.mock("../../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../api/client")>();
  return { ...actual, readManifest: vi.fn(), validateManifest: vi.fn(), saveManifest: vi.fn() };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocked = vi.mocked(client);

const MANIFEST: ManifestItem = {
  name: "unified_data.yaml",
  project: "lemgendary-datasets",
  format: "yaml",
  description: "Dataset registry.",
  exists: true,
  size_bytes: 10,
  path: null,
};

describe("ManifestEditorTab offline and load-failure guards", () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = async (manifests: ManifestItem[], registryError: string | null) => {
    await act(async () => {
      root.render(
        <ManifestEditorTab
          manifests={manifests}
          registryError={registryError}
          selectedName={manifests[0]?.name ?? ""}
          onSelectName={() => undefined}
        />
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  const button = (label: string): HTMLButtonElement =>
    container.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
  const textarea = (): HTMLTextAreaElement => container.querySelector("textarea") as HTMLTextAreaElement;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows the offline banner and disables editing when the registry is unreachable", async () => {
    await render([], "Failed to fetch");
    expect(container.textContent).toContain("Manifest registry is unavailable");
    expect(container.textContent).toContain("Failed to fetch");
    expect(button("Validate syntax of current document").disabled).toBe(true);
    expect(button("Save changes to disk with atomic backup").disabled).toBe(true);
    expect(textarea().disabled).toBe(true);
    expect(mocked.readManifest).not.toHaveBeenCalled();
  });

  it("keeps the buffer empty and Save disabled when the manifest read fails", async () => {
    mocked.readManifest.mockRejectedValue(new Error("Internal Server Error"));
    await render([MANIFEST], null);
    expect(container.textContent).toContain("Could not load unified_data.yaml: Internal Server Error");
    expect(textarea().value).toBe("");
    expect(textarea().disabled).toBe(true);
    expect(button("Validate syntax of current document").disabled).toBe(true);
    expect(button("Save changes to disk with atomic backup").disabled).toBe(true);
  });

  it("enables validation once the manifest loads", async () => {
    mocked.readManifest.mockResolvedValue({ name: MANIFEST.name, format: "yaml", path: "unified_data.yaml", content: "a: 1\n" });
    await render([MANIFEST], null);
    expect(textarea().value).toBe("a: 1\n");
    expect(textarea().disabled).toBe(false);
    expect(button("Validate syntax of current document").disabled).toBe(false);
    expect(container.textContent).not.toContain("Could not load");
  });
});
