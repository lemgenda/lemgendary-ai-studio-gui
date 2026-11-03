/**
 * LemGendary AI Studio - keep the store in sync with the sidecar mesh:
 * mesh status, dashboard data, the log WebSocket fan-in, pipeline completion
 * and auto-start of offline sidecars on launch.
 */

import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import {
  createLogWebSocket,
  fetchEcosystemMesh,
  fetchHardware,
  fetchHealth,
  fetchPipelineStatus,
  isProgressLine,
  probeSidecarPort,
  startAllServices,
} from "../api/client";
import { MeshStatus, PipelineEvent } from "../api/types";
import { useStudioStore } from "../store/useStudioStore";
import { logger, nullOnFailure } from "../utils/logger";
import { sleep, waitForMesh } from "./waitForMesh";

export interface MeshSync {
  /** Refresh mesh status, hardware, health and pipeline status. */
  loadData: () => Promise<void>;
  /** Refresh only the mesh status; resolves true when any sidecar is reachable. */
  refreshMeshStatus: () => Promise<boolean>;
  isRefreshing: boolean;
  lastUpdated: string | null;
  refreshError: string | null;
  setRefreshError: (message: string | null) => void;
  /** Step number of a running single-step pipeline run, or null. */
  runningSingleStepRef: MutableRefObject<number | null>;
}

/** Append a live event; consecutive progress ticks of one step replace each other. */
function appendLiveEvent(prev: PipelineEvent[], ev: PipelineEvent): PipelineEvent[] {
  if (prev.length > 0) {
    const last = prev[prev.length - 1];
    const isCurrProgress = Boolean(ev.is_progress || isProgressLine(ev.message));
    const wasLastProgress = Boolean(last.is_progress || isProgressLine(last.message));
    if (isCurrProgress && wasLastProgress && last.step_name === ev.step_name) {
      const next = [...prev];
      next[next.length - 1] = ev;
      return next;
    }
  }
  return [...prev.slice(-199), ev];
}

function isPipelineTerminalEvent(ev: PipelineEvent, targetStep: number | null): boolean {
  const msg = typeof ev.message === "string" ? ev.message.toLowerCase() : "";
  const isTerminalStatus = ev.status === "success" || ev.status === "warning" || ev.status === "error";
  const isStep7Terminal = (ev.step_name === "Health Matrix" || ev.step_number === 7) && isTerminalStatus;
  const isPipelineTerminal =
    ev.step_name === "Pipeline Error" ||
    isStep7Terminal ||
    msg.includes("pipeline execution completed") ||
    msg.includes("ecosystem healthy status");
  const isSingleStepTerminal =
    targetStep !== null && ev.step_number === targetStep && isTerminalStatus && !ev.is_progress;
  return isPipelineTerminal || isSingleStepTerminal;
}

export function useMeshSync(): MeshSync {
  const setHardware = useStudioStore((s) => s.setHardware);
  const setHealth = useStudioStore((s) => s.setHealth);
  const setEvents = useStudioStore((s) => s.setEvents);
  const isRunningPipeline = useStudioStore((s) => s.isRunningPipeline);
  const setIsRunningPipeline = useStudioStore((s) => s.setIsRunningPipeline);
  const setWsConnected = useStudioStore((s) => s.setWsConnected);
  const setMeshStatus = useStudioStore((s) => s.setMeshStatus);

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const runningSingleStepRef = useRef<number | null>(null);

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
      const [hwData, healthData, pipeStatus] = await Promise.all([
        nullOnFailure(fetchHardware(), "Hardware profile refresh failed"),
        nullOnFailure(fetchHealth(), "Health report refresh failed"),
        nullOnFailure(fetchPipelineStatus(), "Pipeline status refresh failed"),
      ]);

      if (hwData) {
        setHardware(hwData);
      }
      if (healthData) {
        setHealth(healthData);
      }
      if (pipeStatus) {
        setIsRunningPipeline(pipeStatus.is_running);
        if (pipeStatus.recent_events && pipeStatus.recent_events.length > 0) {
          setEvents((prev) => {
            const combined = [...prev, ...pipeStatus.recent_events];
            const unique = Array.from(new Set(combined.map((e) => JSON.stringify(e)))).map((s) => JSON.parse(s));
            return unique.slice(-200);
          });
        }
      }

      await refreshMeshStatus();
      setLastUpdated(new Date().toISOString());
      setRefreshError(null);
    } catch (err: unknown) {
      logger.error("Dashboard refresh failed", err);
      setRefreshError(
        "Refresh failed: No sidecars reachable on ports 8000, 8100, or 8200. " +
        "Launch the ecosystem mesh to synchronize live data."
      );
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
        setEvents((prev) => appendLiveEvent(prev, ev));
        if (isPipelineTerminalEvent(ev, runningSingleStepRef.current)) {
          setIsRunningPipeline(false);
          runningSingleStepRef.current = null;
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
  }, [loadData, refreshMeshStatus, setEvents, setIsRunningPipeline, setWsConnected]);

  // Safety polling to guarantee UI state termination when pipeline or step finishes
  useEffect(() => {
    if (!isRunningPipeline) return;
    const pollInterval = setInterval(async () => {
      try {
        const pipeStatus = await fetchPipelineStatus();
        if (pipeStatus && !pipeStatus.is_running) {
          setIsRunningPipeline(false);
          runningSingleStepRef.current = null;
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
          const mesh = await fetchEcosystemMesh();
          if (cancelled) return;
          const needsStart = !mesh.dataset_compiler.reachable || !mesh.training_suite.reachable;
          if (needsStart) {
            await startAllServices();
            if (cancelled) return;
            // Poll mesh status until all sidecars report ready
            await waitForMesh(
              (check) => Boolean(check?.dataset_compiler.reachable && check?.training_suite.reachable),
              { attempts: 15, intervalMs: 1000, beforeCheck: refreshMeshStatus, isCancelled: () => cancelled }
            );
            if (cancelled) return;
            await loadData();
          }
          break;
        } catch (err: unknown) {
          logger.warn(`Sidecar auto-start attempt ${attempt + 1} of 3 failed`, err);
          await sleep(2000);
        }
      }
    };

    void autoStartOffline();
    return () => {
      cancelled = true;
    };
  }, [loadData, refreshMeshStatus]);

  return { loadData, refreshMeshStatus, isRefreshing, lastUpdated, refreshError, setRefreshError, runningSingleStepRef };
}
