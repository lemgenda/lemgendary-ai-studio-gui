import React, { useEffect, useState, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { HardwareCard } from "./components/HardwareCard";
import { ProjectCard } from "./components/ProjectCard";
import { PipelinePanel } from "./components/PipelinePanel";
import { HealthPanel } from "./components/HealthPanel";
import { LogPanel } from "./components/LogPanel";
import { StatusBar } from "./components/StatusBar";
import { CompilerPanel } from "./components/CompilerPanel";
import { TrainingPanel } from "./components/TrainingPanel";
import { ConfigEditorModal } from "./components/ConfigEditorModal";
import { ServiceTiles } from "./components/ServiceTiles";
import { HelpTooltip } from "./components/HelpTooltip";
import {
  fetchHardware,
  fetchHealth,
  fetchPipelineStatus,
  fetchEcosystemMesh,
  probeSidecarPort,
  triggerPipeline,
  createLogWebSocket,
  startService,
  startAllServices,
} from "./api/client";
import { HardwareProfile, HealthAuditReport, MeshStatus, PipelineEvent, ProjectHealth } from "./api/types";

const FALLBACK_PROJECTS: ProjectHealth[] = [
  { name: "lemgendary-env-manager", project_dir: "./lemgendary-env-manager", venv_exists: false, total_required: 0, total_installed: 0, missing_packages: [], installed_packages: {}, is_healthy: false },
  { name: "lemgendary-datasets", project_dir: "./lemgendary-datasets", venv_exists: false, total_required: 0, total_installed: 0, missing_packages: [], installed_packages: {}, is_healthy: false },
  { name: "lemgendary-training-suite", project_dir: "./lemgendary-training-suite", venv_exists: false, total_required: 0, total_installed: 0, missing_packages: [], installed_packages: {}, is_healthy: false },
  { name: "lemgendary-ai-studio-gui", project_dir: "./lemgendary-ai-studio-gui", venv_exists: false, total_required: 0, total_installed: 0, missing_packages: [], installed_packages: {}, is_healthy: false },
  { name: "lemgendary-docs", project_dir: "./lemgendary-docs", venv_exists: false, total_required: 0, total_installed: 0, missing_packages: [], installed_packages: {}, is_healthy: false },
];

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>("dashboard");
  const [hardware, setHardware] = useState<HardwareProfile | null>(null);
  const [health, setHealth] = useState<HealthAuditReport | null>(null);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isRunningPipeline, setIsRunningPipeline] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isConfigEditorOpen, setIsConfigEditorOpen] = useState<boolean>(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [meshStatus, setMeshStatus] = useState<MeshStatus>({
    envManager: false,
    datasetCompiler: false,
    trainingSuite: false,
  });

  const displayProjects = health?.projects ?? FALLBACK_PROJECTS;

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [hwData, healthData, pipeStatus] = await Promise.all([
        fetchHardware().catch(() => null),
        fetchHealth().catch(() => null),
        fetchPipelineStatus().catch(() => null),
      ]);

      if (hwData) setHardware(hwData);
      if (healthData) setHealth(healthData);
      if (pipeStatus) {
        setIsRunningPipeline(pipeStatus.is_running);
        if (pipeStatus.recent_events && pipeStatus.recent_events.length > 0) {
          setEvents((prev) => {
            const combined = [...prev, ...pipeStatus.recent_events];
            const unique = Array.from(new Set(combined.map((e) => JSON.stringify(e)))).map((s) => JSON.parse(s));
            return unique.slice(-200);
          });
        }
      }

      // Populate sidecar mesh status. Try the ecosystem endpoint on port 8000 first;
      // if it is unreachable, fall back to independent per-port HEAD probes so that
      // mesh awareness works even when the env-manager itself is offline.
      try {
        const mesh = await fetchEcosystemMesh();
        setMeshStatus({
          envManager: mesh.env_manager.reachable,
          datasetCompiler: mesh.dataset_compiler.reachable,
          trainingSuite: mesh.training_suite.reachable,
        });
      } catch {
        const [em, dc, ts] = await Promise.all([
          probeSidecarPort(8000),
          probeSidecarPort(8100),
          probeSidecarPort(8200),
        ]);
        setMeshStatus({ envManager: em, datasetCompiler: dc, trainingSuite: ts });
      }

      setLastUpdated(new Date().toISOString());
      setRefreshError(null);
    } catch {
      setRefreshError(
        "Refresh failed: No sidecars reachable on ports 8000, 8100, or 8200. " +
        "Launch the ecosystem mesh to synchronize live data."
      );
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const cleanupWs = createLogWebSocket(
      (ev) => {
        setEvents((prev) => [...prev.slice(-199), ev]);
        if (ev.step_name === "Health Matrix" && ev.status === "success") {
          loadData();
        }
      },
      (connected) => {
        setWsConnected(connected);
      }
    );

    return () => {
      cleanupWs();
    };
  }, [loadData]);

  const handleRunPipeline = async () => {
    try {
      setIsRunningPipeline(true);
      await triggerPipeline();
    } catch {
      setRefreshError("Pipeline trigger failed: Environment Manager (Port 8000) is not reachable.");
      setIsRunningPipeline(false);
    }
  };

  const handleReconcileProject = async (projectName: string) => {
    try {
      setIsRunningPipeline(true);
      await triggerPipeline(projectName);
    } catch {
      setRefreshError(`Reconcile failed for ${projectName}: Environment Manager (Port 8000) is not reachable.`);
      setIsRunningPipeline(false);
    }
  };

  const [startingServiceId, setStartingServiceId] = useState<string | null>(null);

  const handleStartService = async (serviceId: string) => {
    try {
      setStartingServiceId(serviceId);
      setRefreshError(null);
      await startService(serviceId);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRefreshError(`Failed to start ${serviceId}: ${message}`);
    } finally {
      setStartingServiceId(null);
    }
  };

  const handleStartAllServices = async () => {
    try {
      setStartingServiceId("all");
      setRefreshError(null);
      await startAllServices();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRefreshError(`Failed to start services: ${message}`);
    } finally {
      setStartingServiceId(null);
    }
  };

  const getHeaderTitle = () => {
    switch (currentTab) {
      case "dashboard":
        return "Ecosystem Control Dashboard";
      case "datasets":
        return "Dataset Compiler & Storage Modernization";
      case "training":
        return "Master Training Suite & Architecture Matrix";
      case "pipeline":
        return "Smart Clean Install Pipeline";
      case "projects":
        return "Project Virtual Environments";
      case "health":
        return "Health & Version Drift Matrix";
      case "logs":
        return "Real-time Telemetry Stream";
      default:
        return "LemGendary AI Studio";
    }
  };

  return (
    <div className="app-container">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenConfigEditor={() => setIsConfigEditorOpen(true)}
        meshStatus={meshStatus}
      />

      <div className="main-content">
        <Header
          title={getHeaderTitle()}
          onRefresh={loadData}
          isRefreshing={isRefreshing}
          onOpenConfigEditor={() => setIsConfigEditorOpen(true)}
          envManagerOnline={meshStatus.envManager}
        />

        <main
          id="main-content"
          className="view-container"
          role="tabpanel"
          aria-labelledby={`tab-${currentTab}`}
          tabIndex={-1}
        >
          {/* Global offline banner — shown across all tabs when entire mesh is down */}
          {!meshStatus.envManager && !meshStatus.datasetCompiler && !meshStatus.trainingSuite && (
            <div
              role="alert"
              style={{
                padding: "12px 20px",
                backgroundColor: "rgba(244, 63, 94, 0.12)",
                border: "1px solid var(--accent-rose)",
                borderRadius: "var(--radius-sm)",
                marginBottom: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--accent-rose)", fontWeight: 600 }}>
                Ecosystem mesh offline. All three sidecars (Ports 8000, 8100, 8200) are unreachable.
              </span>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: "12px" }}
                onClick={handleStartAllServices}
                disabled={startingServiceId !== null}
                aria-label="Start all LemGendary ecosystem sidecars"
              >
                {startingServiceId === "all" ? "Starting Services..." : "Start All Services"}
              </button>
            </div>
          )}

          {/* Dismissible refresh error banner */}
          {refreshError && (
            <div
              role="alert"
              style={{
                padding: "10px 16px",
                backgroundColor: "rgba(251, 146, 60, 0.10)",
                border: "1px solid var(--accent-amber, #f59e0b)",
                borderRadius: "var(--radius-sm)",
                marginBottom: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{refreshError}</span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "11px", padding: "2px 10px", flexShrink: 0 }}
                onClick={() => setRefreshError(null)}
                aria-label="Dismiss error message"
              >
                Dismiss
              </button>
            </div>
          )}

          {currentTab === "dashboard" && (
            <>
              <ServiceTiles
                meshStatus={meshStatus}
                onNavigate={setCurrentTab}
                onRunAudit={handleRunPipeline}
                onStartService={handleStartService}
                startingServiceId={startingServiceId}
              />

              <div className="card-grid">
                <HardwareCard
                  hardware={hardware}
                  onStartEnvManager={() => handleStartService("env-manager")}
                />
                <PipelinePanel
                  isRunning={isRunningPipeline}
                  onRunPipeline={handleRunPipeline}
                  recentEvents={events}
                  envManagerOnline={meshStatus.envManager}
                />
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 600 }}>Managed Workspace Projects</h3>
                  <HelpTooltip content="Independent sub-repositories in the workspace governed by the LemGendary environment manager. Each card provides status, package metrics, and individual virtual environment reconciliation." />
                </div>
                <div className="card-grid">
                  {displayProjects.map((p) => (
                    <ProjectCard
                      key={p.name}
                      project={p}
                      onInstall={handleReconcileProject}
                      isProcessing={isRunningPipeline}
                      isOffline={!health}
                    />
                  ))}
                </div>
              </div>

              <LogPanel
                events={events}
                onClear={() => setEvents([])}
                isConnected={wsConnected}
              />
            </>
          )}

          {currentTab === "datasets" && <CompilerPanel datasetCompilerOnline={meshStatus.datasetCompiler} />}

          {currentTab === "training" && <TrainingPanel trainingSuiteOnline={meshStatus.trainingSuite} />}

          {currentTab === "pipeline" && (
            <>
              <PipelinePanel
                isRunning={isRunningPipeline}
                onRunPipeline={handleRunPipeline}
                recentEvents={events}
                envManagerOnline={meshStatus.envManager}
              />
              <LogPanel
                events={events}
                onClear={() => setEvents([])}
                isConnected={wsConnected}
              />
            </>
          )}

          {currentTab === "projects" && (
            <div className="card-grid">
              {displayProjects.map((p) => (
                <ProjectCard
                  key={p.name}
                  project={p}
                  onInstall={handleReconcileProject}
                  isProcessing={isRunningPipeline}
                  isOffline={!health}
                />
              ))}
            </div>
          )}

          {currentTab === "health" && (
            <HealthPanel report={health} onStartEnvManager={() => handleStartService("env-manager")} />
          )}

          {currentTab === "logs" && (
            <LogPanel
              events={events}
              onClear={() => setEvents([])}
              isConnected={wsConnected}
            />
          )}
        </main>

        <StatusBar
          meshStatus={meshStatus}
          backend={hardware?.primary_backend || "unknown"}
          projectCount={health?.projects.length || 0}
          lastUpdated={lastUpdated}
        />
      </div>

      <ConfigEditorModal
        isOpen={isConfigEditorOpen}
        onClose={() => setIsConfigEditorOpen(false)}
      />
    </div>
  );
};

export default App;
