/**
 * LemGendary AI Studio - start and stop sidecars from the UI, then wait until
 * the mesh reports the new state.
 */

import { useState } from "react";
import { startAllServices, startService, stopService } from "../api/client";
import { EcosystemSidecarMesh, SidecarNodeStatus } from "../api/types";
import { errorMessage } from "../utils/logger";
import { waitForMesh } from "./waitForMesh";

/** Mesh node of a service id; `undefined` for an id the mesh does not report. */
function meshNode(mesh: EcosystemSidecarMesh | null, serviceId: string): SidecarNodeStatus | undefined {
  if (!mesh) return undefined;
  switch (serviceId) {
    case "env-manager":
      return mesh.env_manager;
    case "dataset-compiler":
      return mesh.dataset_compiler;
    case "training-suite":
      return mesh.training_suite;
    default:
      return undefined;
  }
}

const KNOWN_SERVICE_IDS = new Set(["env-manager", "dataset-compiler", "training-suite"]);

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

      await startService(serviceId);

      // Poll mesh status for up to 15 seconds to confirm readiness
      await waitForMesh((check) => meshNode(check, serviceId)?.reachable === true, {
        attempts: 15,
        intervalMs: 1000,
        beforeCheck: refreshMeshStatus,
      });
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

      await stopService(serviceId);

      // Poll mesh status to confirm offline state
      await waitForMesh((check) => KNOWN_SERVICE_IDS.has(serviceId) && !meshNode(check, serviceId)?.reachable, {
        attempts: 10,
        intervalMs: 500,
        beforeCheck: refreshMeshStatus,
      });
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

      await startAllServices();

      // Poll mesh status for up to 15 seconds to confirm all 3 sidecars report ready
      await waitForMesh(
        (check) => Boolean(check?.dataset_compiler?.reachable && check?.training_suite?.reachable),
        { attempts: 15, intervalMs: 1000, beforeCheck: refreshMeshStatus }
      );
      await loadData();
    } catch (err: unknown) {
      setRefreshError(`Failed to start services: ${errorMessage(err)}`);
    } finally {
      setStartingServiceId(null);
    }
  };

  return { startingServiceId, stoppingServiceId, handleStartService, handleStopService, handleStartAllServices };
}
