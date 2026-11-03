/**
 * LemGendary AI Studio - sidecar liveness probes and start/stop, through the
 * Environment Manager or the desktop app's native spawn commands.
 */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { logger } from "../utils/logger";
import { MESH_SERVICES, ServiceId } from "./config";
import { ENV_BASE } from "./endpoints";
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
    url = match ? `${match.httpUrl}${match.livenessPath}` : `http://127.0.0.1:${target}/api/health`;
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

export async function stopService(serviceId: string): Promise<ServiceOperationResult> {
  const res = await sidecarFetch(`${ENV_BASE}/api/services/${encodeURIComponent(serviceId)}/stop`, {
    method: "POST",
  });
  if (!res.ok) return throwHttpError(res, `Stop ${serviceId}`);
  return res.json();
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
