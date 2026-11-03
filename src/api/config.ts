/**
 * Tripartite mesh topology, derived from the ecosystem snapshot
 * (src/generated/ecosystem.json: ports, websocket and liveness paths, names).
 *
 * Configures endpoints dynamically with support for environment variable overrides
 * (VITE_ENV_MANAGER_URL, VITE_DATASET_COMPILER_URL, VITE_TRAINING_SUITE_URL).
 * Allows the entire ecosystem to migrate seamlessly across local ports, custom networks,
 * Docker containers, or hosted cloud HTTPS/WSS endpoints without code modification.
 */

import { logger } from "../utils/logger";
import { ECOSYSTEM, ecosystemProject, ecosystemService } from "./ecosystem";

export type ServiceId = "env-manager" | "dataset-compiler" | "training-suite";

export interface MeshServiceConfig {
  id: ServiceId;
  name: string;
  defaultPort: number;
  httpUrl: string;
  wsUrl: string;
  defaultStep: string;
  /** Cheap liveness endpoint used by the online probe (never a full audit). */
  livenessPath: string;
}

const getEnvVar = (key: string, fallback: string): string => {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key]) {
    return String(import.meta.env[key]);
  }
  return fallback;
};

export const toWebSocketUrl = (httpUrl: string, wsPath: string): string => {
  try {
    const parsed = new URL(wsPath, httpUrl);
    parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    return parsed.toString();
  } catch (err: unknown) {
    logger.warn(`Invalid sidecar URL "${httpUrl}" + "${wsPath}"; deriving the WebSocket URL by prefix swap`, err);
    return httpUrl.replace(/^http/, "ws") + (wsPath.startsWith("/") ? wsPath : `/${wsPath}`);
  }
};

/** GUI-only metadata per service: env-var override names and the log step label. */
interface ServiceUiSpec {
  httpEnvVar: string;
  wsEnvVar: string;
  defaultStep: string;
}

const SERVICE_UI: Record<ServiceId, ServiceUiSpec> = {
  "env-manager": { httpEnvVar: "VITE_ENV_MANAGER_URL", wsEnvVar: "VITE_ENV_MANAGER_WS", defaultStep: "EnvManager" },
  "dataset-compiler": { httpEnvVar: "VITE_DATASET_COMPILER_URL", wsEnvVar: "VITE_DATASET_COMPILER_WS", defaultStep: "Compiler" },
  "training-suite": { httpEnvVar: "VITE_TRAINING_SUITE_URL", wsEnvVar: "VITE_TRAINING_SUITE_WS", defaultStep: "Training" },
};

/** Builds a service's config from the ecosystem snapshot, applying `VITE_*` overrides. */
const buildService = (id: ServiceId): MeshServiceConfig => {
  const service = ecosystemService(id);
  const ui = SERVICE_UI[id];
  const httpUrl = getEnvVar(ui.httpEnvVar, `http://${ECOSYSTEM.identity.bind_host}:${service.port}`);
  return {
    id,
    name: ecosystemProject(service.project).display_name,
    defaultPort: service.port,
    httpUrl,
    wsUrl: getEnvVar(ui.wsEnvVar, toWebSocketUrl(httpUrl, service.websocket_path)),
    defaultStep: ui.defaultStep,
    livenessPath: service.liveness_path,
  };
};

export const MESH_SERVICES: Record<ServiceId, MeshServiceConfig> = {
  "env-manager": buildService("env-manager"),
  "dataset-compiler": buildService("dataset-compiler"),
  "training-suite": buildService("training-suite"),
};

/** Every mesh service id, Environment Manager first (it starts the others). */
export const SERVICE_IDS: readonly ServiceId[] = Object.keys(MESH_SERVICES) as ServiceId[];

/** Default port of a service from the ecosystem snapshot, for user-facing text. */
export const servicePort = (id: ServiceId): number => MESH_SERVICES[id].defaultPort;

/** Every service's default port, comma separated, for user-facing text. */
export const servicePortList = (): string => SERVICE_IDS.map(servicePort).join(", ");
