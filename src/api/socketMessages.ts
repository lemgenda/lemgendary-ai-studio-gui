/**
 * LemGendary AI Studio - normalization of sidecar WebSocket messages into PipelineEvents.
 */

import { MESH_SERVICES } from "./config";
import { kaggleLogStatus } from "./kaggleLogLines";
import { cleanAnsiAndControlChars, isProgressLine } from "./telemetry";
import { PipelineEvent } from "./types";

function jobRoutingData(raw: Record<string, unknown>): Record<string, unknown> | undefined {
  if (raw.job_id === undefined && raw.job_type === undefined) return undefined;
  return { job_id: raw.job_id, job_type: raw.job_type };
}

export function normalizeSocketMessage(
  data: unknown,
  defaultStep: string,
  origin?: "env-manager" | "training-suite" | "dataset-compiler",
  port?: number
): PipelineEvent | null {
  if (!data || typeof data !== "object") return null;

  const raw = data as Record<string, unknown>;

  // 1. Native PipelineEvent from env-manager
  if (typeof raw.step_name === "string" && typeof raw.message === "string") {
    const cleanMsg = cleanAnsiAndControlChars(raw.message);
    if (!cleanMsg) return null;
    const isProgress = Boolean(raw.is_progress || isProgressLine(cleanMsg));
    const rawStatus = String(raw.status || "info").toLowerCase();
    const status: PipelineEvent["status"] =
      rawStatus === "success" || rawStatus === "warning" || rawStatus === "error"
        ? rawStatus
        : "info";

    return {
      step_number: typeof raw.step_number === "number" ? raw.step_number : 0,
      total_steps: typeof raw.total_steps === "number" ? raw.total_steps : 1,
      step_name: raw.step_name,
      status,
      message: cleanMsg,
      is_progress: isProgress,
      timestamp: typeof raw.timestamp === "string" ? raw.timestamp : new Date().toISOString(),
      // Training-suite broadcasts carry job_id/job_type at the top level; keep them for stream routing.
      data: raw.data || jobRoutingData(raw)
        ? { ...jobRoutingData(raw), ...((raw.data as Record<string, unknown>) || {}) }
        : undefined,
      origin: origin || "env-manager",
      port: port || MESH_SERVICES["env-manager"].defaultPort,
    };
  }

  // 2. Training Suite daemon broadcast
  if (typeof raw.message === "string") {
    const cleanMsg = cleanAnsiAndControlChars(raw.message);
    if (!cleanMsg) return null;
    const isProgress = Boolean(raw.is_progress || isProgressLine(cleanMsg));
    const kaggleStatus = kaggleLogStatus(cleanMsg);
    let status: PipelineEvent["status"] = "info";
    const msgLower = cleanMsg.toLowerCase();
    if (kaggleStatus) {
      status = kaggleStatus;
    } else if (msgLower.includes("[error]") || msgLower.includes("failed") || msgLower.includes("exception")) {
      status = "error";
    } else if (msgLower.includes("[success]") || msgLower.includes("complete")) {
      status = "success";
    } else if (msgLower.includes("[warn")) {
      status = "warning";
    }

    return {
      step_number: 0,
      total_steps: 1,
      step_name: typeof raw.step_name === "string" ? raw.step_name : defaultStep,
      status,
      message: cleanMsg,
      is_progress: isProgress,
      timestamp: typeof raw.timestamp === "string" ? raw.timestamp : new Date().toISOString(),
      data: jobRoutingData(raw),
      origin: origin || "training-suite",
      port: port || MESH_SERVICES["training-suite"].defaultPort,
    };
  }

  // 3. Dataset Compiler chunk broadcast
  if (typeof raw.chunk === "string") {
    const cleanMsg = cleanAnsiAndControlChars(raw.chunk);
    if (!cleanMsg) return null;
    const isProgress = Boolean(isProgressLine(cleanMsg));
    return {
      step_number: 0,
      total_steps: 1,
      step_name: defaultStep,
      status: "info",
      message: cleanMsg,
      is_progress: isProgress,
      timestamp: new Date().toISOString(),
      origin: origin || "dataset-compiler",
      port: port || MESH_SERVICES["dataset-compiler"].defaultPort,
    };
  }

  return null;
}
