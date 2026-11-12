// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "../../api/client";
import { TabItem, TabList, TabPanel } from "../common/Tabs";
import { ExternalLink } from "../common/ExternalLink";
import { ServiceTiles } from "../ServiceTiles";
import { Sidebar } from "../Sidebar";
import { PipelinePanel } from "../PipelinePanel";
import { ConfigEditorModal } from "../ConfigEditorModal";
import { kaggleModelLinks, kaggleRefOwner } from "../training/kaggleLinks";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  openExternalUrl: vi.fn(async () => undefined),
  fetchManifestRegistry: vi.fn(),
  readManifest: vi.fn(),
  fetchSecrets: vi.fn(async () => []),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const mocked = vi.mocked(client);

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);

describe("Tabs primitive (D23, D27)", () => {
  type Id = "a" | "b" | "c";
  const items: TabItem<Id>[] = [
    { id: "a", label: "A" },
    { id: "b", label: "B", domId: "custom-b" },
    { id: "c", label: "C" },
  ];
  const Harness = () => {
    const [value, setValue] = useState<Id>("a");
    return (
      <>
        <TabList idPrefix="t" label="Demo" items={items} value={value} onChange={setValue} tabClassName={(s) => (s ? "on" : "off")} />
        <TabPanel idPrefix="t" items={items} value={value}>
          panel {value}
        </TabPanel>
      </>
    );
  };

  it("holds only tabs, points aria-controls at the real panel and moves with arrow keys", () => {
    act(() => root.render(<Harness />));
    const tabs = Array.from(document.querySelectorAll('[role="tablist"] > *'));
    expect(tabs.every((t) => t.getAttribute("role") === "tab")).toBe(true);
    expect(tabs.every((t) => t.getAttribute("aria-controls") === "t-panel")).toBe(true);
    expect($("#t-panel")?.getAttribute("aria-labelledby")).toBe("t-tab-a");

    act(() => $<HTMLButtonElement>("#t-tab-a")!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect($("#custom-b")?.getAttribute("aria-selected")).toBe("true");
    expect($("#custom-b")?.getAttribute("tabindex")).toBe("0");
    expect(document.activeElement?.id).toBe("custom-b");
    expect($("#t-panel")?.getAttribute("aria-labelledby")).toBe("custom-b");

    act(() => $<HTMLButtonElement>("#custom-b")!.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })));
    expect($("#t-panel")?.textContent).toBe("panel c");
  });
});

describe("sidebar and pipeline semantics (D23, D28)", () => {
  it("renders the sidebar as navigation with aria-current, not a tablist with help buttons inside", () => {
    const html = renderToStaticMarkup(
      <Sidebar currentTab="training" onSelectTab={() => undefined} meshStatus={{ envManager: true, datasetCompiler: true, trainingSuite: true }} />
    );
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain('<nav class="nav-menu" aria-label="Workspace Sections">');
    expect(html).toMatch(/id="tab-training"[^>]*aria-current="page"/);
  });

  it("keeps help buttons out of the pipeline progressbar", () => {
    act(() => root.render(<PipelinePanel isRunning={false} onRunPipeline={() => undefined} recentEvents={[]} envManagerOnline />));
    const bar = $('[role="progressbar"]');
    expect(bar).not.toBeNull();
    expect(bar?.querySelector("button")).toBeNull();
    expect(document.querySelectorAll('ol[aria-label="Pipeline steps"] > li').length).toBe(7);
  });
});

describe("destructive action confirmation (D34)", () => {
  it("stops a service only after the confirmation", () => {
    const onStop = vi.fn();
    act(() =>
      root.render(
        <ServiceTiles
          meshStatus={{ envManager: true, datasetCompiler: true, trainingSuite: true }}
          onNavigate={() => undefined}
          onRunAudit={() => undefined}
          onStartService={() => undefined}
          onStopService={onStop}
        />
      )
    );
    const stop = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Stop Service")!;
    act(() => stop.click());
    expect(onStop).not.toHaveBeenCalled();
    expect($('[role="dialog"]')?.textContent).toContain("Stop this service?");
    expect(document.activeElement?.id).toBe("dash-dialog-stop-service-cancel");

    act(() => $<HTMLButtonElement>("#dash-dialog-stop-service-cancel")!.click());
    expect($('[role="dialog"]')).toBeNull();
    act(() => stop.click());
    act(() => $<HTMLButtonElement>("#dash-dialog-stop-service-confirm")!.click());
    expect(onStop).toHaveBeenCalledWith("env-manager");
  });
});

describe("config editor (D20, D21, D24)", () => {
  const manifests = [
    { name: "a.yaml", project: "p", format: "yaml" as const, description: "", exists: true, size_bytes: 1, path: null },
    { name: "b.yaml", project: "p", format: "yaml" as const, description: "", exists: true, size_bytes: 1, path: null },
  ];

  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  it("loads the registry once and asks before discarding unsaved edits", async () => {
    mocked.fetchManifestRegistry.mockResolvedValue(manifests);
    mocked.readManifest.mockImplementation(async (name: string) => ({ name, content: `name: ${name}\n` }) as never);
    await act(async () => root.render(<ConfigEditorModal isOpen onClose={() => undefined} />));
    await flush();

    const select = $<HTMLSelectElement>("#manifest-select")!;
    expect(select.value).toBe("a.yaml");
    const setValue = (el: HTMLSelectElement | HTMLTextAreaElement, value: string) => {
      const proto = Object.getPrototypeOf(el);
      Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    };

    // Switching without edits: no prompt, registry not refetched (D20)
    await act(async () => setValue(select, "b.yaml"));
    await flush();
    expect(mocked.readManifest).toHaveBeenLastCalledWith("b.yaml");
    expect(mocked.fetchManifestRegistry).toHaveBeenCalledTimes(1);

    // Edit, then switch: a confirmation appears and the edit stays until confirmed (D21)
    await act(async () => setValue($<HTMLTextAreaElement>(".editor-textarea")!, "edited: true\n"));
    await act(async () => setValue($<HTMLSelectElement>("#manifest-select")!, "a.yaml"));
    expect($("#config-dialog-discard-manifest")?.textContent).toContain("b.yaml has unsaved edits");
    act(() => $<HTMLButtonElement>("#config-dialog-discard-manifest-cancel")!.click());
    expect($<HTMLTextAreaElement>(".editor-textarea")!.value).toBe("edited: true\n");

    // Leaving the manifest tab with edits also asks first
    act(() => $<HTMLButtonElement>("#config-tabs-tab-secrets")!.click());
    expect($("#config-dialog-discard-edits")).not.toBeNull();
    expect($("#config-tabs-tab-manifests")?.getAttribute("aria-selected")).toBe("true");
  });
});

describe("Kaggle owner and external links (D32, D38)", () => {
  it("builds Kaggle URLs from the credential username and the backend handles only", () => {
    const handles = {
      slug: "nima-aesthetic-mobile",
      datasetUrls: ["https://www.kaggle.com/datasets/owner/lemgendizednimaaesthetic"],
    };
    expect(kaggleModelLinks(null, handles)).toBeNull();
    expect(kaggleModelLinks("someone", null)).toBeNull();
    expect(kaggleModelLinks("someone", handles)).toEqual({
      notebookUrl: "https://www.kaggle.com/code/someone/nima-aesthetic-mobile-training",
      modelHubUrl: "https://www.kaggle.com/models/someone/nima-aesthetic-mobile",
      datasetUrls: ["https://www.kaggle.com/datasets/owner/lemgendizednimaaesthetic"],
    });
    expect(kaggleRefOwner("kaggle://owner/dataset")).toBe("owner");
    expect(kaggleRefOwner(undefined)).toBeNull();
  });

  it("opens external links through openExternalUrl", () => {
    act(() => root.render(<ExternalLink href="https://example.org/">site</ExternalLink>));
    const link = $<HTMLAnchorElement>("a")!;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => link.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(mocked.openExternalUrl).toHaveBeenCalledWith("https://example.org/");
  });
});

