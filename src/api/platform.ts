/**
 * LemGendary AI Studio - platform integration (desktop app vs. browser session).
 */

import { isTauri } from "@tauri-apps/api/core";
import { open as openWithShell } from "@tauri-apps/plugin-shell";

/** Open an external URL: the system browser in the desktop app, a new tab in a browser session. */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    await openWithShell(url);
    return;
  }
  const opened = window.open(url, "_blank");
  if (opened === null) {
    throw new Error(`The browser blocked opening ${url}`);
  }
  opened.opener = null;
}
