/**
 * LemGendary AI Studio - find offline sidecars by probing each one directly
 * and start them, Environment Manager first.
 *
 * The probes do not depend on the Environment Manager, so a mesh whose
 * Environment Manager is down is still detected and started.
 */

import { MESH_SERVICES, SERVICE_IDS, ServiceId, probeSidecarPort, startAllServices, startService } from "../api/client";
import { PollOptions, waitUntil } from "./waitForMesh";

/** Ids of the services whose liveness probe does not answer, in `SERVICE_IDS` order. */
export async function offlineServices(): Promise<ServiceId[]> {
  const online = await Promise.all(SERVICE_IDS.map((id) => probeSidecarPort(id)));
  return SERVICE_IDS.filter((_, i) => !online[i]);
}

/** Human-readable list of service names for error messages. */
export function serviceNames(ids: readonly ServiceId[]): string {
  return ids.map((id) => MESH_SERVICES[id].name).join(", ");
}

/** Error thrown when started services do not answer within the poll window. */
export class ServiceStartTimeoutError extends Error {
  constructor(public readonly pending: readonly ServiceId[], seconds: number) {
    super(
      `${serviceNames(pending)} did not answer within ${seconds} s. ` +
        "The process may have exited on startup; check its log (the desktop app writes it to the app log folder)."
    );
    this.name = "ServiceStartTimeoutError";
  }
}

/**
 * Start every offline sidecar and wait until all answer.
 *
 * - Environment Manager offline: start it first (native spawn); once it
 *   answers it starts the rest. If it never answers, the rest are spawned
 *   natively one by one, so nothing is spawned twice.
 * - Environment Manager online: it starts the offline ones (`start-all`).
 *
 * Resolves with the services that were offline; throws
 * `ServiceStartTimeoutError` when some still do not answer.
 */
export async function startOfflineServices(options: PollOptions): Promise<ServiceId[]> {
  const offline = await offlineServices();
  if (offline.length === 0) return [];

  if (offline.includes("env-manager")) {
    await startService("env-manager");
    const envUp = await waitUntil(() => probeSidecarPort("env-manager"), options);
    if (options.isCancelled?.()) return offline;
    const rest = offline.filter((id) => id !== "env-manager");
    if (envUp && rest.length > 0) {
      await startAllServices();
    } else {
      for (const id of rest) await startService(id);
    }
  } else {
    await startAllServices();
  }

  let pending: ServiceId[] = offline;
  const allUp = await waitUntil(async () => {
    pending = await offlineServices();
    return pending.length === 0;
  }, options);
  if (!allUp && !options.isCancelled?.()) {
    throw new ServiceStartTimeoutError(pending, Math.round((options.attempts * options.intervalMs) / 1000));
  }
  return offline;
}
