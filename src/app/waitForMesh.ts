/**
 * LemGendary AI Studio - poll until a condition holds (mesh readiness, a
 * sidecar answering its liveness probe).
 */

import { fetchEcosystemMesh } from "../api/client";
import { EcosystemSidecarMesh } from "../api/types";
import { nullOnFailure } from "../utils/logger";

export interface PollOptions {
  attempts: number;
  intervalMs: number;
  /** Called before each check (for example to refresh the store's mesh status). */
  beforeCheck?: () => Promise<unknown>;
  /** Stops polling early when it returns true. */
  isCancelled?: () => boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `check` after each interval until it resolves true or the attempts run
 * out. Resolves true when the condition held, false on timeout or cancel.
 */
export async function waitUntil(
  check: () => Promise<boolean>,
  { attempts, intervalMs, beforeCheck, isCancelled }: PollOptions
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    await sleep(intervalMs);
    if (isCancelled?.()) return false;
    if (beforeCheck) await beforeCheck();
    if (await check()) return true;
  }
  return false;
}

/**
 * Poll `GET /api/gui/ecosystem` until `done(mesh)` is true or the attempts run out.
 * An unreachable mesh endpoint counts as `null` for `done`. Resolves false on timeout.
 */
export function waitForMesh(
  done: (mesh: EcosystemSidecarMesh | null) => boolean,
  options: PollOptions
): Promise<boolean> {
  return waitUntil(
    async () => done(await nullOnFailure(fetchEcosystemMesh(), "Mesh readiness poll failed", "debug")),
    options
  );
}

export { sleep };
