import React, { useEffect, useState } from "react";
import { fetchDocsStatus, openExternalUrl } from "../api/client";
import { HelpTooltip } from "./HelpTooltip";
import { servicePort } from "../api/config";
import { logger } from "../utils/logger";

interface DocumentationPanelProps {
  envManagerOnline: boolean;
}

export const DocumentationPanel: React.FC<DocumentationPanelProps> = ({ envManagerOnline }) => {
  const [docsUrl, setDocsUrl] = useState<string | null>(null);
  const [onlineUrl, setOnlineUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorReason, setErrorReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!envManagerOnline) {
      setDocsUrl(null);
      setIsLoading(false);
      setErrorReason(
        `Environment Manager (Port ${servicePort("env-manager")}) is offline. Launch it to load the local offline documentation hub.`,
      );
      return;
    }

    setIsLoading(true);
    fetchDocsStatus()
      .then((status) => {
        if (cancelled) return;
        setIsLoading(false);
        if (status.offline_available && status.local_url) {
          setDocsUrl(status.local_url);
          setOnlineUrl(status.online_url || null);
          setErrorReason(null);
        } else if (status.online_url) {
          setDocsUrl(status.online_url);
          setOnlineUrl(status.online_url);
          setErrorReason(null);
        } else {
          setDocsUrl(null);
          setErrorReason("No documentation bundle available locally or online.");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setIsLoading(false);
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn("Failed to fetch documentation status", err);
        setDocsUrl(null);
        setErrorReason(`Documentation Hub unavailable: ${msg}`);
      });

    return () => {
      cancelled = true;
    };
  }, [envManagerOnline]);

  const handleOpenExternal = () => {
    const target = docsUrl || onlineUrl;
    if (target) {
      openExternalUrl(target).catch((err: unknown) => {
        logger.error("Failed to open docs externally", err);
      });
    }
  };

  return (
    <div className="docs-panel-container">
      <div className="docs-panel-header">
        <div className="row-gap-md">
          <h3 className="card-heading">LemGendary AI Documentation Hub</h3>
          <HelpTooltip content="Embedded local offline documentation hub. Browse architectural whitepapers, benchmark data, model architectures, and ecosystem manuals directly inside LemGendary AI Studio." />
        </div>
        <div className="row-gap-sm">
          {docsUrl && (
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={handleOpenExternal}
              title="Open documentation in external web browser"
            >
              Open in External Browser
            </button>
          )}
        </div>
      </div>

      <div className="docs-panel-content">
        {isLoading && (
          <div className="docs-loading-state">
            <span className="badge badge-info">LOADING DOCUMENTATION HUB...</span>
          </div>
        )}

        {!isLoading && errorReason && (
          <div className="card docs-error-card">
            <div className="card-title">
              <h4 className="card-heading">Documentation Hub Offline</h4>
              <span className="badge badge-error">UNAVAILABLE</span>
            </div>
            <p className="docs-error-text">{errorReason}</p>
          </div>
        )}

        {!isLoading && docsUrl && (
          <iframe
            src={docsUrl}
            title="LemGendary AI Documentation Hub"
            className="docs-iframe"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        )}
      </div>
    </div>
  );
};

export default DocumentationPanel;
