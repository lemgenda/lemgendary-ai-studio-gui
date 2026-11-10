/**
 * LemGendary AI Studio - start and stop sidecars from the UI, then wait until
 * each service's own liveness probe reports the new state.
 */

import { useState } from "react";
import { MESH_SERVICES, ServiceId, probeSidecarPort, startService, stopService } from "../api/client";
import { errorMessage } from "../utils/logger";
import { ServiceStartTimeoutError, startOfflineServices } from "./serviceStartup";
import { PollOptions, waitUntil } from "./waitForMesh";

const START_POLL: PollOptions = { attempts: 15, intervalMs: 1000 };
const STOP_POLL: PollOptions = { attempts: 16, intervalMs: 500 };

function isServiceId(id: string): id is ServiceId {
  return id in MESH_SERVICES;
}

export interface ServiceControlDeps {
  refreshMeshStatus: () => Promise<boolean>;
  loadData: () => Promise<void>;
  setRefreshError: (message: string | null) => void;
}

export interface ServiceControls {
  /** Service being started (`"all"` for Start All), or null. */
  startingServiceId: string | null;
  stoppingServiceId: string | null;
  handleStartService: (serviceId: string) => Promise<void>;
  handleStopService: (serviceId: string) => Promise<void>;
  handleStartAllServices: () => Promise<void>;
}

export function useServiceControls({ refreshMeshStatus, loadData, setRefreshError }: ServiceControlDeps): ServiceControls {
  const [startingServiceId, setStartingServiceId] = useState<string | null>(null);
  const [stoppingServiceId, setStoppingServiceId] = useState<string | null>(null);

  const handleStartService = async (serviceId: string) => {
    try {
      setStartingServiceId(serviceId);
      setRefreshError(null);
      if (!isServiceId(serviceId)) throw new Error(`Unknown service '${serviceId}'`);

      await startService(serviceId);

      const ready = await waitUntil(() => probeSidecarPort(serviceId), { ...START_POLL, beforeCheck: refreshMeshStatus });
      if (!ready) {
        throw new ServiceStartTimeoutError([serviceId], (START_POLL.attempts * START_POLL.intervalMs) / 1000);
      }
      await loadData();
    } catch (err: unknown) {
      setRefreshError(`Failed to start ${serviceId}: ${errorMessage(err)}`);
    } finally {
      setStartingServiceId(null);
    }
  };

  const handleStopService = async (serviceId: string) => {
    try {
      setStoppingServiceId(serviceId);
      setRefreshError(null);
      if (!isServiceId(serviceId)) throw new Error(`Unknown service '${serviceId}'`);

      await stopService(serviceId);

      const stopped = await waitUntil(async () => !(await probeSidecarPort(serviceId)), {
        ...STOP_POLL,
        beforeCheck: refreshMeshStatus,
      });
      if (!stopped) {
        throw new Error(`${MESH_SERVICES[serviceId].name} still answers after the stop request.`);
      }
      await loadData();
    } catch (err: unknown) {
      setRefreshError(`Failed to stop ${serviceId}: ${errorMessage(err)}`);
    } finally {
      setStoppingServiceId(null);
    }
  };

  const handleStartAllServices = async () => {
    try {
      setStartingServiceId("all");
      setRefreshError(null);
      await startOfflineServices({ ...START_POLL, beforeCheck: refreshMeshStatus });
      await loadData();
    } catch (err: unknown) {
      setRefreshError(`Failed to start services: ${errorMessage(err)}`);
    } finally {
      setStartingServiceId(null);
    }
  };

  return { startingServiceId, stoppingServiceId, handleStartService, handleStopService, handleStartAllServices };
}
