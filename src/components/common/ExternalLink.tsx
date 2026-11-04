/**
 * LemGendary AI Studio - a link that opens in the system browser.
 *
 * In the desktop app a plain `target="_blank"` depends on the WebView's
 * new-window behaviour, so the click goes through `openExternalUrl` (Tauri
 * shell `open`, or `window.open` in a browser). The `href` stays for
 * semantics, hover preview and "copy link".
 */

import React from "react";
import { openExternalUrl } from "../../api/client";
import { logger } from "../../utils/logger";

export type ExternalLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel" | "onClick"> & {
  href: string;
};

export const ExternalLink: React.FC<ExternalLinkProps> = ({ href, children, ...rest }) => (
  <a
    {...rest}
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(event) => {
      event.preventDefault();
      openExternalUrl(href).catch((err: unknown) => logger.error(`Opening ${href} failed`, err));
    }}
  >
    {children}
  </a>
);
