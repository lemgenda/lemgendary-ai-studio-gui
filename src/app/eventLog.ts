/**
 * LemGendary AI Studio - the shared event log buffer: live WebSocket events
 * and the Environment Manager's REST `recent_events`, normalized the same way
 * and de-duplicated by timestamp, step and message.
 */

import { MESH_SERVICES, isProgressLine, normalizeSocketMessage } from "../api/client";
import { PipelineEvent } from "../api/types";

/** Most events kept in the shared log buffer. */
export const EVENT_BUFFER_LIMIT = 200;

/** Identity of an event across the REST and WebSocket paths. */
export function eventKey(ev: PipelineEvent): string {
  return `${ev.timestamp}|${ev.step_name}|${ev.message}`;
}

/** Append a live event; consecutive progress ticks of one step replace each other. */
export function appendLiveEvent(prev: PipelineEvent[], ev: PipelineEvent): PipelineEvent[] {
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
  return [...prev.slice(-(EVENT_BUFFER_LIMIT - 1)), ev];
}

/**
 * Merge the Environment Manager's REST `recent_events` into the buffer.
 * Each REST event goes through the WebSocket normalizer (so it carries the
 * same `origin`/`port`) and is dropped when an event with the same
 * timestamp, step and message is already present.
 */
export function mergeRecentEvents(prev: PipelineEvent[], recent: readonly unknown[]): PipelineEvent[] {
  const env = MESH_SERVICES["env-manager"];
  const seen = new Set(prev.map(eventKey));
  const merged = [...prev];
  for (const raw of recent) {
    const ev = normalizeSocketMessage(raw, env.defaultStep, env.id, env.defaultPort);
    if (!ev) continue;
    const key = eventKey(ev);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(ev);
  }
  return merged.slice(-EVENT_BUFFER_LIMIT);
}
