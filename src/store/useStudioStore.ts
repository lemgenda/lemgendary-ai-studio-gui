import { create } from "zustand";
import {
  HardwareProfile,
  HealthAuditReport,
  MeshStatus,
  ProjectHealth,
  PipelineEvent,
  ModelItem,
  DatasetItem,
} from "../api/types";
import { DEFAULT_TAB_ID, isWorkspaceTabId } from "../navigation/workspaceTabs";
import { EVENT_BUFFER_LIMIT, appendLiveEvent } from "../app/eventLog";

export interface ActiveJobState {
  jobId: string | null;
  modelKey: string | null;
}

/**
 * What the current (or most recent) install pipeline run covers: the whole
 * pipeline (`"full"`, also used for a single-project reconcile) or one step
 * number. `startedAt` scopes the step pills to this run's events.
 */
export interface PipelineRun {
  scope: "full" | number;
  startedAt: string;
}

/** The app-level modals; at most one is open at a time. */
export type StudioModalId = "config" | "tests" | "bug-report";

export interface StudioState {
  // Navigation
  currentTab: string;
  setCurrentTab: (tab: string) => void;

  // The open app-level modal (one field, so two modals can never be open at once)
  activeModal: StudioModalId | null;
  openModal: (modal: StudioModalId) => void;
  closeModal: () => void;

  // Tripartite Sidecar Mesh Status (ports from src/generated/ecosystem.json)
  meshStatus: MeshStatus;
  setMeshStatus: (status: MeshStatus | ((prev: MeshStatus) => MeshStatus)) => void;

  // Host Telemetry & Project Environment Health
  hardware: HardwareProfile | null;
  setHardware: (hardware: HardwareProfile | null) => void;
  health: HealthAuditReport | null;
  setHealth: (health: HealthAuditReport | null) => void;
  /** Replace only the project health rows of the current report (no-op without a report). */
  setProjects: (projects: ProjectHealth[]) => void;

  // Global Active Running Jobs
  localJob: ActiveJobState;
  setLocalJob: (job: ActiveJobState) => void;
  remoteJob: ActiveJobState;
  setRemoteJob: (job: ActiveJobState) => void;

  // Cached Collections (eliminates tab-switching re-fetch latency)
  cachedModels: ModelItem[];
  setCachedModels: (models: ModelItem[] | ((prev: ModelItem[]) => ModelItem[])) => void;
  cachedDatasets: DatasetItem[];
  setCachedDatasets: (datasets: DatasetItem[] | ((prev: DatasetItem[]) => DatasetItem[])) => void;

  // Telemetry Event Stream Buffer (with windowing to protect against DOM bloat)
  events: PipelineEvent[];
  setEvents: (events: PipelineEvent[] | ((prev: PipelineEvent[]) => PipelineEvent[])) => void;
  addEvent: (event: PipelineEvent) => void;
  addTelemetryLog: (message: string, status?: "info" | "success" | "warning" | "error") => void;
  clearEvents: () => void;

  // WebSocket Connection Status
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;

  // Pipeline Running Status
  isRunningPipeline: boolean;
  setIsRunningPipeline: (running: boolean) => void;
  /** Kept after the run ends so the pills keep showing its result. */
  pipelineRun: PipelineRun | null;
  /** Record a new run and mark the pipeline as running. */
  startPipelineRun: (scope: PipelineRun["scope"]) => void;

  // Global Refresh Error / Notification
  notification: string | null;
  setNotification: (msg: string | null) => void;
}

const getInitialTab = (): string => {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (isWorkspaceTabId(tab)) {
      return tab;
    }
  }
  return DEFAULT_TAB_ID;
};

/** `?modal=config` or `?modal=secrets` opens the config editor on start. */
const getInitialModal = (): StudioModalId | null => {
  if (typeof window !== "undefined") {
    const modal = new URLSearchParams(window.location.search).get("modal");
    if (modal === "config" || modal === "secrets") {
      return "config";
    }
  }
  return null;
};

export const useStudioStore = create<StudioState>((set) => ({
  currentTab: getInitialTab(),
  setCurrentTab: (tab) => set({ currentTab: tab }),

  activeModal: getInitialModal(),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),

  meshStatus: {
    envManager: false,
    datasetCompiler: false,
    trainingSuite: false,
  },
  setMeshStatus: (status) =>
    set((state) => ({
      meshStatus: typeof status === "function" ? status(state.meshStatus) : status,
    })),

  hardware: null,
  setHardware: (hardware) => set({ hardware }),

  health: null,
  setHealth: (health) => set({ health }),
  setProjects: (projects) => set((state) => (state.health ? { health: { ...state.health, projects } } : {})),

  localJob: { jobId: null, modelKey: null },
  setLocalJob: (job) => set({ localJob: job }),

  remoteJob: { jobId: null, modelKey: null },
  setRemoteJob: (job) => set({ remoteJob: job }),

  cachedModels: [],
  setCachedModels: (models) =>
    set((state) => ({
      cachedModels: typeof models === "function" ? models(state.cachedModels) : models,
    })),

  cachedDatasets: [],
  setCachedDatasets: (datasets) =>
    set((state) => ({
      cachedDatasets: typeof datasets === "function" ? datasets(state.cachedDatasets) : datasets,
    })),

  events: [],
  setEvents: (events) =>
    set((state) => ({
      events: typeof events === "function" ? events(state.events) : events,
    })),

  addEvent: (event) => set((state) => ({ events: appendLiveEvent(state.events, event) })),

  addTelemetryLog: (message, status = "info") =>
    set((state) => {
      const event: PipelineEvent = {
        timestamp: new Date().toISOString(),
        step_number: 0,
        total_steps: 0,
        step_name: "Studio Console",
        status,
        message,
      };
      return { events: [...state.events.slice(-(EVENT_BUFFER_LIMIT - 1)), event] };
    }),

  clearEvents: () => set({ events: [] }),

  wsConnected: false,
  setWsConnected: (connected) => set({ wsConnected: connected }),

  isRunningPipeline: false,
  setIsRunningPipeline: (running) => set({ isRunningPipeline: running }),
  pipelineRun: null,
  startPipelineRun: (scope) =>
    set({ pipelineRun: { scope, startedAt: new Date().toISOString() }, isRunningPipeline: true }),

  notification: null,
  setNotification: (msg) => set({ notification: msg }),
}));
