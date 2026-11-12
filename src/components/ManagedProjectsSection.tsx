/**
 * LemGendary AI Studio - dashboard grid of the managed workspace projects,
 * with a refresh of their environment health from `GET /api/projects`
 * (lighter than the full health audit behind the header refresh).
 */

import React, { useState } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { ProjectCard } from "./ProjectCard";
import { ValidationBanner } from "./common/ValidationBanner";
import { fetchProjects } from "../api/client";
import { ProjectHealth } from "../api/types";
import { useStudioStore } from "../store/useStudioStore";
import { errorMessage } from "../utils/logger";

interface ManagedProjectsSectionProps {
  projects: ProjectHealth[];
  onInstall: (projectName: string) => void;
  isProcessing: boolean;
  /** True while no health report is loaded: the cards show placeholders. */
  isOffline: boolean;
  envManagerOnline: boolean;
}

export const ManagedProjectsSection: React.FC<ManagedProjectsSectionProps> = ({
  projects,
  onInstall,
  isProcessing,
  isOffline,
  envManagerOnline,
}) => {
  const setProjects = useStudioStore((s) => s.setProjects);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const handleRefreshProjects = async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      setProjects(await fetchProjects());
    } catch (err: unknown) {
      setRefreshError(`Project health refresh failed: ${errorMessage(err)}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 600 }}>Managed Workspace Projects</h3>
        <HelpTooltip content="Independent sub-repositories in the workspace governed by the LemGendary environment manager. Each card provides status, package metrics, and individual virtual environment reconciliation." />
        <button
          type="button"
          id="dash-btn-refresh-projects"
          className="btn btn-secondary"
          onClick={() => void handleRefreshProjects()}
          disabled={isRefreshing || isProcessing || isOffline || !envManagerOnline}
          title="Re-reads each project's virtual environment and installed packages from the Environment Manager"
          style={{ marginLeft: "auto", fontSize: "12px", padding: "5px 12px" }}
        >
          {isRefreshing ? "Refreshing..." : "Refresh Projects"}
        </button>
      </div>
      {refreshError && (
        <ValidationBanner
          type="error"
          message={refreshError}
          onDismiss={() => setRefreshError(null)}
          style={{ marginBottom: "16px", fontSize: "12px" }}
        />
      )}
      <div className="card-grid">
        {projects.map((p) => (
          <ProjectCard key={p.name} project={p} onInstall={onInstall} isProcessing={isProcessing} isOffline={isOffline} />
        ))}
      </div>
    </div>
  );
};
