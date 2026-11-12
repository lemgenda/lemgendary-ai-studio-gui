/**
 * LemGendary AI Studio - display text of the Training Suite Kaggle status
 * (`GET /api/training/kaggle/status`, a real authenticated call).
 */

import { KaggleAuthMethod, KaggleSuiteStatus } from "../../api/types";

const AUTH_METHOD_LABELS: Record<KaggleAuthMethod, string> = {
  access_token: "access token (KGAT_)",
  legacy_api_key: "legacy API key",
};

export interface KaggleAuthView {
  /** Badge text. */
  badge: "AUTHENTICATED" | "NOT AUTHENTICATED" | "CHECKING";
  /** One-line detail under the check title. */
  detail: string;
  /** Error banner text; null when authenticated or not checked yet. */
  problem: string | null;
}

/** How the credentials check reads; `status` null means the check has not answered yet. */
export function describeKaggleAuth(status: KaggleSuiteStatus | null): KaggleAuthView {
  if (!status) return { badge: "CHECKING", detail: "Checking the Kaggle credentials...", problem: null };
  const method = status.auth_method ? ` with ${AUTH_METHOD_LABELS[status.auth_method]}` : "";
  if (status.authenticated) {
    return { badge: "AUTHENTICATED", detail: `Authenticated as @${status.username}${method}`, problem: null };
  }
  const who = status.username ? ` as @${status.username}` : "";
  const http = status.http_status !== null ? ` (HTTP ${status.http_status})` : "";
  const reason = status.error
    ?? (status.token_configured ? "Kaggle refused the configured token" : "No Kaggle token is configured");
  return {
    badge: "NOT AUTHENTICATED",
    detail: status.token_configured ? `Token configured${method}, not accepted` : "No Kaggle token configured",
    problem: `Kaggle authentication failed${who}${http}: ${reason}. Check the Kaggle entry in the Secrets Vault.`,
  };
}
