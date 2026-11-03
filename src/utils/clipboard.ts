import { logger } from "./logger";

/**
 * Copy text to the system clipboard with fallback support for Tauri/WebView environments.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (clipboardErr: unknown) {
    logger.debug("Async clipboard API unavailable; falling back to execCommand", clipboardErr);
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch (fallbackErr: unknown) {
      logger.warn("Clipboard copy failed", fallbackErr);
      return false;
    }
  }
}

