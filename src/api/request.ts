/**
 * LemGendary AI Studio - shared sidecar request helpers.
 *
 * Error-body parsing and error construction used by every per-service API
 * module. Transport itself is `sidecarFetch` (./http).
 */

import { logger } from "../utils/logger";
import { sidecarFetch } from "./http";

/**
 * Readable message from a sidecar error body: FastAPI `detail` is either a
 * string (HTTPException) or a list of `{loc, msg}` entries (422 validation).
 */
export function sidecarErrorDetail(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) return fallback;
  const { detail, message } = body as { detail?: unknown; message?: unknown };
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((entry: unknown) => {
        if (typeof entry !== "object" || entry === null) return String(entry);
        const { loc, msg } = entry as { loc?: unknown; msg?: unknown };
        const where = Array.isArray(loc) ? loc.filter((p) => p !== "body").join(".") : "";
        return where ? `${where}: ${String(msg)}` : String(msg);
      })
      .filter((part) => part.length > 0);
    if (parts.length > 0) return parts.join("; ");
  }
  if (typeof message === "string" && message) return message;
  return fallback;
}

/** Parsed JSON body of a failed response, or `null` (logged) when the body is not JSON. */
export async function readErrorBody(res: Response, action: string): Promise<unknown> {
  try {
    return await res.json();
  } catch (parseErr: unknown) {
    logger.warn(`${action}: error response body is not JSON (HTTP ${res.status})`, parseErr);
    return null;
  }
}

/** Throw an `Error` carrying the sidecar's detail for a failed response, or `fallback`. */
export async function throwSidecarError(res: Response, fallback: string): Promise<never> {
  const body = await readErrorBody(res, fallback);
  throw new Error(sidecarErrorDetail(body, fallback));
}

/** Throw with the sidecar's detail, falling back to "`action` failed: HTTP <status>". */
export async function throwHttpError(res: Response, action: string): Promise<never> {
  return throwSidecarError(res, `${action} failed: HTTP ${res.status} ${res.statusText}`.trim());
}

/** POST a JSON payload (or no body when `payload` is undefined). */
export function postJson(url: string, payload?: unknown): Promise<Response> {
  return sidecarFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}
