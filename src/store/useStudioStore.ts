import { create } from "zustand";
import {
  HardwareProfile,
  HealthAuditReport,
  MeshStatus,
  PipelineEvent,
  ModelItem,
  DatasetItem,
} from "../api/types";

export interface ActiveJobState {
  jobId: string | null;
  modelKey: string | null;
}

export interface StudioState {
  // Navigation
  currentTab: string;
  setCurrentTab: (tab: string) => void;

  // Tripartite Sidecar Mesh Status (8000, 8100, 8200)
  meshStatus: MeshStatus;
  setMeshStatus: (status: MeshStatus | ((prev: MeshStatus) => MeshStatus)) => void;

  // Host Telemetry & Project Environment Health
  hardware: HardwareProfile | null;
  setHardware: (hardware: HardwareProfile | null) => void;
  health: HealthAuditReport | null;
  setHealth: (health: HealthAuditReport | null) => void;

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

  // Global Refresh Error / Notification
  notification: string | null;
  setNotification: (msg: string | null) => void;
}

const MAX_EVENTS_BUFFER = 200;

export const useStudioStore = create<StudioState>((set) => ({
  currentTab: "dashboard",
  setCurrentTab: (tab) => set({ currentTab: tab }),

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

  addEvent: (event) =>
    set((state) => {
      const prev = state.events;
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        const isCurrProgress = Boolean(event.is_progress);
        const wasLastProgress = Boolean(last.is_progress);
        if (isCurrProgress && wasLastProgress && last.step_name === event.step_name) {
          const next = [...prev];
          next[next.length - 1] = event;
          return { events: next };
        }
      }
      return { events: [...prev.slice(-(MAX_EVENTS_BUFFER - 1)), event] };
    }),

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
      return { events: [...state.events.slice(-(MAX_EVENTS_BUFFER - 1)), event] };
    }),

  clearEvents: () => set({ events: [] }),

  wsConnected: false,
  setWsConnected: (connected) => set({ wsConnected: connected }),

  isRunningPipeline: false,
  setIsRunningPipeline: (running) => set({ isRunningPipeline: running }),

  notification: null,
  setNotification: (msg) => set({ notification: msg }),
}));
