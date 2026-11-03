/**
 * LemGendary AI Studio - WebSocket fan-in across all mesh sidecars with reconnects.
 */

import { logger } from "../utils/logger";
import { MESH_SERVICES } from "./config";
import { normalizeSocketMessage } from "./socketMessages";
import { PipelineEvent } from "./types";

const MESH_WEBSOCKET_URLS = Object.values(MESH_SERVICES).map((svc) => ({
  id: svc.id,
  url: svc.wsUrl,
  defaultStep: svc.defaultStep,
  port: svc.defaultPort,
}));

export function createLogWebSocket(
  onEvent: (event: PipelineEvent) => void,
  onStatusChange: (connected: boolean) => void
): () => void {
  let active = true;
  const sockets = new Map<string, WebSocket>();
  const retryTimers = new Map<string, number>();
  const connectionStates = new Map<string, boolean>();

  const updateAggregatedStatus = () => {
    const isAnyConnected = Array.from(connectionStates.values()).some(Boolean);
    onStatusChange(isAnyConnected);
  };

  const connectEndpoint = (endpoint: (typeof MESH_WEBSOCKET_URLS)[number]) => {
    if (!active) return;

    try {
      const ws = new WebSocket(endpoint.url);
      sockets.set(endpoint.id, ws);

      ws.onopen = () => {
        connectionStates.set(endpoint.id, true);
        updateAggregatedStatus();
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const normalized = normalizeSocketMessage(parsed, endpoint.defaultStep, endpoint.id, endpoint.port);
          if (normalized) {
            onEvent(normalized);
          }
        } catch (err: unknown) {
          logger.debug(`Ignoring non-JSON frame from ${endpoint.id} socket`, err);
        }
      };

      ws.onclose = () => {
        connectionStates.set(endpoint.id, false);
        updateAggregatedStatus();
        if (active) {
          const timer = window.setTimeout(() => connectEndpoint(endpoint), 3000);
          retryTimers.set(endpoint.id, timer);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (err: unknown) {
      logger.warn(`Could not open ${endpoint.id} socket at ${endpoint.url}; retrying in 3 s`, err);
      connectionStates.set(endpoint.id, false);
      updateAggregatedStatus();
      if (active) {
        const timer = window.setTimeout(() => connectEndpoint(endpoint), 3000);
        retryTimers.set(endpoint.id, timer);
      }
    }
  };

  for (const ep of MESH_WEBSOCKET_URLS) {
    connectEndpoint(ep);
  }

  return () => {
    active = false;
    for (const timer of retryTimers.values()) {
      clearTimeout(timer);
    }
    retryTimers.clear();
    for (const ws of sockets.values()) {
      ws.close();
    }
    sockets.clear();
  };
}
