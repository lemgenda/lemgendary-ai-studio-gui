/**
 * LemGendary AI Studio - sidecar liveness probes and start/stop, through the
 * Environment Manager or the desktop app's native spawn commands.
 */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { logger } from "../utils/logger";
import { MESH_SERVICES, ServiceId } from "./config";
import { ENV_BASE } from "./endpoints";
import { ECOSYSTEM } from "./ecosystem";
import { sidecarFetch } from "./http";
import { throwHttpError } from "./request";
import { ServiceOperationResult } from "./types";

/**
 * Lightweight reachability probe for a single sidecar port.
 * Uses a 1500 ms AbortController timeout so the UI never hangs waiting.
 * Falls back to false on any network error or timeout.
 */
export async function probeSidecarPort(target: number | ServiceId): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 2000);
  let url: string;
  if (typeof target === "string" && target in MESH_SERVICES) {
    const service = MESH_SERVICES[target];
    url = `${service.httpUrl}${service.livenessPath}`;
  } else {
    const match = Object.values(MESH_SERVICES).find((s) => s.defaultPort === target);
    url = match ? `${match.httpUrl}${match.livenessPath}` : `http://${ECOSYSTEM.identity.bind_host}:${target}/api/health`;
  }
  try {
    const res = await sidecarFetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    return res.ok;
  } catch (err: unknown) {
    logger.debug(`Liveness probe failed for ${url}`, err);
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Tauri native command used when the Environment Manager cannot start services itself. */
async function invokeNativeSpawn(command: "spawn_service" | "spawn_all_services", args?: Record<string, unknown>): Promise<void> {
  if (!isTauri()) {
    throw new Error(
      "The Environment Manager is offline and this is a plain browser session, so services cannot be started from here. " +
        "Start the Environment Manager manually or use the LemGendary AI Studio desktop app."
    );
  }
  await invoke(command, args);
}

/**
 * Start one sidecar. The Environment Manager starts services when it is online;
 * when it is offline (or it is the service being started) the desktop app's
 * native `spawn_service` command is used instead.
 */
export async function startService(serviceId: string): Promise<ServiceOperationResult> {
  const envOnline = await probeSidecarPort("env-manager");
  if (serviceId === "env-manager" && envOnline) {
    return {
      status: "already_running",
      message: "Environment Manager is already online.",
      port: MESH_SERVICES["env-manager"].defaultPort,
    };
  }
  if (envOnline) {
    const res = await sidecarFetch(`${ENV_BASE}/api/services/${encodeURIComponent(serviceId)}/start`, {
      method: "POST",
    });
    if (!res.ok) return throwHttpError(res, `Start ${serviceId}`);
    return res.json();
  }
  await invokeNativeSpawn("spawn_service", { serviceId });
  return {
    status: "started",
    message: `Spawned ${serviceId} via the desktop app.`,
    port: MESH_SERVICES[serviceId as ServiceId]?.defaultPort,
  };
}

/** Stop a sidecar through the Environment Manager's HTTP endpoint. */
async function stopServiceViaEnvManager(serviceId: string): Promise<ServiceOperationResult> {
  let res: Response;
  try {
    res = await sidecarFetch(`${ENV_BASE}/api/services/${encodeURIComponent(serviceId)}/stop`, {
      method: "POST",
    });
  } catch (err: unknown) {
    const envPort = MESH_SERVICES["env-manager"].defaultPort;
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Environment Manager (port ${envPort}) is offline (${reason}), so it cannot stop ${serviceId}. ` +
        "Start the Environment Manager or use the LemGendary AI Studio desktop app."
    );
  }
  if (!res.ok) return throwHttpError(res, `Stop ${serviceId}`);
  return res.json();
}

/**
 * Stop one sidecar. The desktop app terminates the process listening on the
 * service's port with the native `stop_service` command, which also works when
 * the Environment Manager is offline or is the service being stopped. When that
 * command fails (or in a plain browser session) the Environment Manager's stop
 * endpoint is used; if both fail, both reasons are reported.
 */
export async function stopService(serviceId: string): Promise<ServiceOperationResult> {
  if (!isTauri()) return stopServiceViaEnvManager(serviceId);
  try {
    return await invoke<ServiceOperationResult>("stop_service", { serviceId });
  } catch (nativeErr: unknown) {
    const nativeMessage = nativeErr instanceof Error ? nativeErr.message : String(nativeErr);
    logger.warn(`Native stop of ${serviceId} failed, trying the Environment Manager: ${nativeMessage}`);
    try {
      return await stopServiceViaEnvManager(serviceId);
    } catch (httpErr: unknown) {
      const httpMessage = httpErr instanceof Error ? httpErr.message : String(httpErr);
      throw new Error(`Native stop failed (${nativeMessage}); ${httpMessage}`);
    }
  }
}

/**
 * Start every offline sidecar: through the Environment Manager when it is
 * online, otherwise through the desktop app's native `spawn_all_services`.
 */
export async function startAllServices(): Promise<{ results: Record<string, ServiceOperationResult> }> {
  if (await probeSidecarPort("env-manager")) {
    const res = await sidecarFetch(`${ENV_BASE}/api/services/start-all`, {
      method: "POST",
    });
    if (!res.ok) return throwHttpError(res, "Start all services");
    return res.json();
  }
  await invokeNativeSpawn("spawn_all_services");
  return { results: {} };
}
