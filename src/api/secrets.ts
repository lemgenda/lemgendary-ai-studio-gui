/**
 * LemGendary AI Studio - Ecosystem Secrets & Tokens Vault (Environment Manager).
 */

import { logger } from "../utils/logger";
import { ENV_BASE } from "./endpoints";
import { sidecarFetch } from "./http";
import { throwSidecarError } from "./request";
import { SecretDraft, SecretItem, SecretsSaveResponse, SecretWriteItem } from "./types";

/** Stored secrets (masked); an unreachable or failing vault is logged and yields `[]`. */
export async function fetchSecrets(): Promise<SecretItem[]> {
  try {
    const res = await sidecarFetch(`${ENV_BASE}/api/secrets`);
    if (!res.ok) {
      logger.warn(`Secrets vault request failed: HTTP ${res.status} ${res.statusText}`);
      return [];
    }
    const data = (await res.json()) as { secrets?: SecretItem[] };
    return data.secrets || [];
  } catch (err: unknown) {
    logger.warn("Secrets vault is unreachable", err);
    return [];
  }
}

/**
 * Convert editor drafts to the write-only payload. Masking fields are dropped
 * and an empty `secret_value` tells the server to keep the stored value.
 */
export function toSecretWriteItems(drafts: SecretDraft[]): SecretWriteItem[] {
  return drafts.map((d) => ({
    id: d.id,
    service: d.service,
    label: d.label,
    username: d.username ?? null,
    server: d.server ?? null,
    is_default: Boolean(d.is_default),
    created_at: d.created_at ?? null,
    secret_value: (d.secret_value ?? "").trim(),
  }));
}

export async function saveSecrets(drafts: SecretDraft[]): Promise<SecretsSaveResponse> {
  const res = await sidecarFetch(`${ENV_BASE}/api/secrets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secrets: toSecretWriteItems(drafts) }),
  });
  if (!res.ok) return throwSidecarError(res, `Failed to save secrets: ${res.statusText}`);
  return res.json();
}
