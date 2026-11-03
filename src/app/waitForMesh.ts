/**
 * LemGendary AI Studio - poll the ecosystem mesh until a condition holds.
 */

import { fetchEcosystemMesh } from "../api/client";
import { EcosystemSidecarMesh } from "../api/types";
import { nullOnFailure } from "../utils/logger";

export interface MeshPollOptions {
  attempts: number;
  intervalMs: number;
  /** Called before each check (for example to refresh the store's mesh status). */
  beforeCheck?: () => Promise<unknown>;
  /** Stops polling early when it returns true. */
  isCancelled?: () => boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Poll `GET /api/gui/ecosystem` until `done(mesh)` is true or the attempts run out.
 * An unreachable mesh endpoint counts as `null` for `done`.
 */
export async function waitForMesh(
  done: (mesh: EcosystemSidecarMesh | null) => boolean,
  { attempts, intervalMs, beforeCheck, isCancelled }: MeshPollOptions
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    await sleep(intervalMs);
    if (isCancelled?.()) return;
    if (beforeCheck) await beforeCheck();
    const check = await nullOnFailure(fetchEcosystemMesh(), "Mesh readiness poll failed", "debug");
    if (done(check)) return;
  }
}

export { sleep };
