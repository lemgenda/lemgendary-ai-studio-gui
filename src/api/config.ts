/**
 * Single Source of Truth for Tripartite Mesh Topology.
 * 
 * Configures endpoints dynamically with support for environment variable overrides
 * (VITE_ENV_MANAGER_URL, VITE_DATASET_COMPILER_URL, VITE_TRAINING_SUITE_URL).
 * Allows the entire ecosystem to migrate seamlessly across local ports, custom networks,
 * Docker containers, or hosted cloud HTTPS/WSS endpoints without code modification.
 */

export type ServiceId = "env-manager" | "dataset-compiler" | "training-suite";

export interface MeshServiceConfig {
  id: ServiceId;
  name: string;
  defaultPort: number;
  httpUrl: string;
  wsUrl: string;
  defaultStep: string;
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
  } catch {
    return httpUrl.replace(/^http/, "ws") + (wsPath.startsWith("/") ? wsPath : `/${wsPath}`);
  }
};

const ENV_HTTP = getEnvVar("VITE_ENV_MANAGER_URL", "http://127.0.0.1:8000");
const DATASETS_HTTP = getEnvVar("VITE_DATASET_COMPILER_URL", "http://127.0.0.1:8100");
const TRAINING_HTTP = getEnvVar("VITE_TRAINING_SUITE_URL", "http://127.0.0.1:8200");

export const MESH_SERVICES: Record<ServiceId, MeshServiceConfig> = {
  "env-manager": {
    id: "env-manager",
    name: "LemGendary Environment Manager",
    defaultPort: 8000,
    httpUrl: ENV_HTTP,
    wsUrl: getEnvVar("VITE_ENV_MANAGER_WS", toWebSocketUrl(ENV_HTTP, "/ws/log")),
    defaultStep: "EnvManager",
  },
  "dataset-compiler": {
    id: "dataset-compiler",
    name: "LemGendary Dataset Compiler Suite",
    defaultPort: 8100,
    httpUrl: DATASETS_HTTP,
    wsUrl: getEnvVar("VITE_DATASET_COMPILER_WS", toWebSocketUrl(DATASETS_HTTP, "/api/ws/events")),
    defaultStep: "Compiler",
  },
  "training-suite": {
    id: "training-suite",
    name: "LemGendary Model Training Suite",
    defaultPort: 8200,
    httpUrl: TRAINING_HTTP,
    wsUrl: getEnvVar("VITE_TRAINING_SUITE_WS", toWebSocketUrl(TRAINING_HTTP, "/api/ws/logs")),
    defaultStep: "Training",
  },
};
