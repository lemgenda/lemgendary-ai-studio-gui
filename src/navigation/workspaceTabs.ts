import { servicePort } from "../api/config";
/**
 * Workspace tabs shown in the sidebar: the single list of tab ids, labels and
 * help texts. The sidebar, the initial-tab parser and the bug report module
 * select all read it from here.
 */

export interface WorkspaceTab {
  id: string;
  label: string;
  /** Header title while the tab is open. */
  title: string;
  tooltip: string;
}

export const WORKSPACE_TABS: readonly WorkspaceTab[] = [
  { id: "dashboard", label: "Dashboard", title: "Ecosystem Control Dashboard", tooltip: "Ecosystem overview: system hardware, quick clean install orchestrator, managed project environments, and live log stream." },
  { id: "datasets", label: "LemGendary Dataset Compiler Suite", title: "LemGendary Dataset Compiler Suite", tooltip: `Port ${servicePort("dataset-compiler")} sidecar: inspect manifold formats, sample counts, and trigger multi-threaded streaming WebDataset compilation.` },
  { id: "training", label: "LemGendary Model Training Suite", title: "LemGendary Model Training Suite", tooltip: `Port ${servicePort("training-suite")} sidecar: neural architecture cards, Sawtooth Governor VRAM telemetry, spatial ladder progression, and training dispatch.` },
  { id: "pipeline", label: "Clean Install Pipeline", title: "Smart Clean Install Pipeline", tooltip: "Deterministic 7-step environment recreation, toolchain audit, wheel cache purging, and bytecode verification." },
  { id: "health", label: "Health & Version Drift", title: "Health & Version Drift Matrix", tooltip: "Host toolchain prerequisites audit and cross-project package version comparison matrix." },
];

export const DEFAULT_TAB_ID = "dashboard";

export function isWorkspaceTabId(value: string | null | undefined): value is string {
  return typeof value === "string" && WORKSPACE_TABS.some((tab) => tab.id === value);
}

/** Label of a tab id; unknown ids are returned unchanged. */
export function workspaceTabLabel(id: string): string {
  return WORKSPACE_TABS.find((tab) => tab.id === id)?.label ?? id;
}

/** Header title of a tab id; unknown ids get the application name. */
export function workspaceTabTitle(id: string): string {
  return WORKSPACE_TABS.find((tab) => tab.id === id)?.title ?? "LemGendary AI Studio GUI";
}
