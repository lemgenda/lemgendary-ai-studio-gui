/**
 * LemGendary AI Studio - sidecar HTTP helper.
 *
 * Every sidecar (Environment Manager, Dataset Compiler, Training Suite)
 * refuses state-changing browser requests that do not carry the client
 * header below. All sidecar calls go through `sidecarFetch` so the header
 * is defined and sent from one place.
 */

export const CLIENT_HEADER = "X-LemGendary-Client";
export const CLIENT_HEADER_VALUE = "ai-studio-gui";

/** `fetch` with the AI Studio client header added to the request. */
export function sidecarFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set(CLIENT_HEADER, CLIENT_HEADER_VALUE);
  return fetch(input, { ...init, headers });
}
