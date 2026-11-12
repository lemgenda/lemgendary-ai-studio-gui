/**
 * LemGendary AI Studio - keep the store in sync with the sidecar mesh:
 * mesh status, dashboard data, the log WebSocket fan-in, pipeline completion
 * and auto-start of offline sidecars on launch.
 */

import { useCallback, useEffect, useState } from "react";
import {
  createLogWebSocket,
  fetchEcosystemMesh,
  fetchHardware,
  fetchHealth,
  fetchPipelineStatus,
  probeSidecarPort,
} from "../api/client";
import { ECOSYSTEM } from "../api/ecosystem";
import { MeshStatus, PipelineEvent } from "../api/types";
import { useStudioStore } from "../store/useStudioStore";
import { errorMessage, logger } from "../utils/logger";
import { mergeRecentEvents } from "./eventLog";
import { startOfflineServices } from "./serviceStartup";
import { sleep } from "./waitForMesh";

/**
 * Banner text for a dashboard refresh, or null when every source loaded.
 * Each rejected source is logged with its label.
 */
export function refreshErrorMessage(
  labels: readonly string[],
  results: readonly PromiseSettledResult<unknown>[]
): string | null {
  const failed: string[] = [];
  let firstError = "";
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      logger.warn(`${labels[i]} refresh failed`, result.reason);
      if (failed.length === 0) firstError = errorMessage(result.reason);
      failed.push(labels[i]);
    }
  });
  if (failed.length === 0) return null;
  return `Refresh incomplete: ${failed.join(", ")} could not be loaded from the Environment Manager (${firstError}).`;
}

export interface MeshSync {
  /** Refresh mesh status, hardware, health and pipeline status. */
  loadData: () => Promise<void>;
  /** Refresh only the mesh status; resolves true when any sidecar is reachable. */
  refreshMeshStatus: () => Promise<boolean>;
  isRefreshing: boolean;
  lastUpdated: string | null;
  refreshError: string | null;
  setRefreshError: (message: string | null) => void;
}

/** Last step in the ecosystem snapshot; its terminal event ends a full pipeline run. */
const FINAL_PIPELINE_STEP = ECOSYSTEM.pipeline_steps[ECOSYSTEM.pipeline_steps.length - 1];

function isPipelineTerminalEvent(ev: PipelineEvent, targetStep: number | null): boolean {
  const msg = typeof ev.message === "string" ? ev.message.toLowerCase() : "";
  const isTerminalStatus = ev.status === "success" || ev.status === "warning" || ev.status === "error";
  const isFinalStepTerminal =
    (ev.step_name === FINAL_PIPELINE_STEP.name || ev.step_number === FINAL_PIPELINE_STEP.number) && isTerminalStatus;
  const isPipelineTerminal =
    ev.step_name === "Pipeline Error" ||
    isFinalStepTerminal ||
    msg.includes("pipeline execution completed") ||
    msg.includes("ecosystem healthy status");
  const isSingleStepTerminal =
    targetStep !== null && ev.step_number === targetStep && isTerminalStatus && !ev.is_progress;
  return isPipelineTerminal || isSingleStepTerminal;
}

/** Step number of a running single-step pipeline run, or null (read live inside socket callbacks). */
function runningSingleStep(): number | null {
  const { isRunningPipeline, pipelineRun } = useStudioStore.getState();
  return isRunningPipeline && pipelineRun && typeof pipelineRun.scope === "number" ? pipelineRun.scope : null;
}

export function useMeshSync(): MeshSync {
  const setHardware = useStudioStore((s) => s.setHardware);
  const setHealth = useStudioStore((s) => s.setHealth);
  const setEvents = useStudioStore((s) => s.setEvents);
  const addEvent = useStudioStore((s) => s.addEvent);
  const isRunningPipeline = useStudioStore((s) => s.isRunningPipeline);
  const setIsRunningPipeline = useStudioStore((s) => s.setIsRunningPipeline);
  const setWsConnected = useStudioStore((s) => s.setWsConnected);
  const setMeshStatus = useStudioStore((s) => s.setMeshStatus);

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const refreshMeshStatus = useCallback(async () => {
    let newMesh: MeshStatus;
    try {
      const mesh = await fetchEcosystemMesh();
      newMesh = {
        envManager: mesh.env_manager.reachable,
        datasetCompiler: mesh.dataset_compiler.reachable,
        trainingSuite: mesh.training_suite.reachable,
      };
      setMeshStatus(newMesh);
      return true;
    } catch (err: unknown) {
      logger.debug("Ecosystem mesh endpoint unreachable; probing each sidecar port", err);
      const [em, dc, ts] = await Promise.all([
        probeSidecarPort("env-manager"),
        probeSidecarPort("dataset-compiler"),
        probeSidecarPort("training-suite"),
      ]);
      newMesh = { envManager: em, datasetCompiler: dc, trainingSuite: ts };
      setMeshStatus(newMesh);
      return em || dc || ts;
    }
  }, [setMeshStatus]);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    // Refresh mesh status immediately (<100ms) so sidecar cards are instantly accurate
    void refreshMeshStatus();

    try {
      const [hwResult, healthResult, pipeResult] = await Promise.allSettled([
        fetchHardware(),
        fetchHealth(),
        fetchPipelineStatus(),
      ]);

      if (hwResult.status === "fulfilled") {
        setHardware(hwResult.value);
      }
      if (healthResult.status === "fulfilled") {
        setHealth(healthResult.value);
      }
      if (pipeResult.status === "fulfilled") {
        const pipeStatus = pipeResult.value;
        setIsRunningPipeline(pipeStatus.is_running);
        if (pipeStatus.recent_events && pipeStatus.recent_events.length > 0) {
          setEvents((prev) => mergeRecentEvents(prev, pipeStatus.recent_events));
        }
      }

      await refreshMeshStatus();
      setLastUpdated(new Date().toISOString());

      const err = refreshErrorMessage(["Hardware profile", "Health report", "Pipeline status"], [hwResult, healthResult, pipeResult]);
      // If the entire mesh or the environment manager is completely offline, suppress
      // the transient "Refresh incomplete: Failed to fetch" banner since the top-level
      // MeshOfflineBanner already clearly instructs the user to start services.
      const isEnvManagerReachable = await probeSidecarPort("env-manager");
      if (!isEnvManagerReachable) {
        setRefreshError(null);
      } else {
        setRefreshError(err);
      }
    } catch (err: unknown) {
      logger.error("Dashboard refresh failed", err);
      setRefreshError(`Refresh failed: ${errorMessage(err)}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshMeshStatus, setEvents, setHardware, setHealth, setIsRunningPipeline]);

  useEffect(() => {
    loadData();

    // Periodic lightweight mesh poll (every 4 seconds) to ensure sidecar transitions are always live
    const meshInterval = setInterval(() => {
      void refreshMeshStatus();
    }, 4000);

    const cleanupWs = createLogWebSocket(
      (ev) => {
        addEvent(ev);
        if (isPipelineTerminalEvent(ev, runningSingleStep())) {
          setIsRunningPipeline(false);
          void loadData();
        }
      },
      (connected) => {
        setWsConnected(connected);
      }
    );

    return () => {
      clearInterval(meshInterval);
      cleanupWs();
    };
  }, [addEvent, loadData, refreshMeshStatus, setIsRunningPipeline, setWsConnected]);

  // Safety polling to guarantee UI state termination when pipeline or step finishes
  useEffect(() => {
    if (!isRunningPipeline) return;
    const pollInterval = setInterval(async () => {
      try {
        const pipeStatus = await fetchPipelineStatus();
        if (pipeStatus && !pipeStatus.is_running) {
          setIsRunningPipeline(false);
          void loadData();
        }
      } catch (err: unknown) {
        logger.debug("Pipeline status poll failed; retrying", err);
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [isRunningPipeline, loadData, setIsRunningPipeline]);

  // Auto-start any offline sidecars on GUI startup
  useEffect(() => {
    let cancelled = false;
    const autoStartOffline = async () => {
      // Grace period for initial local network and server hydration
      await sleep(1200);
      if (cancelled) return;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const started = await startOfflineServices({
            attempts: 15,
            intervalMs: 1000,
            beforeCheck: refreshMeshStatus,
            isCancelled: () => cancelled,
          });
          if (cancelled) return;
          if (started.length > 0) await loadData();
          break;
        } catch (err: unknown) {
          logger.warn(`Sidecar auto-start attempt ${attempt + 1} of 3 failed`, err);
          await sleep(2000);
          if (cancelled) return;
        }
      }
    };

    void autoStartOffline();
    return () => {
      cancelled = true;
    };
  }, [loadData, refreshMeshStatus]);

  return { loadData, refreshMeshStatus, isRefreshing, lastUpdated, refreshError, setRefreshError };
}
