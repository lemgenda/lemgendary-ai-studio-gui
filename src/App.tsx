import React, { useEffect, useState, useCallback, useRef } from "react";
import { useStudioStore } from "./store/useStudioStore";
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
import { PipelineStepCards } from "./components/PipelineStepCards";
import {
  fetchHardware,
  fetchHealth,
  fetchPipelineStatus,
  fetchEcosystemMesh,
  probeSidecarPort,
  triggerPipeline,
  triggerPipelineStep,
  createLogWebSocket,
  isProgressLine,
  isCompilerEvent,
  startService,
  stopService,
  startAllServices,
} from "./api/client";
import { MeshStatus, ProjectHealth } from "./api/types";

const FALLBACK_PROJECTS: ProjectHealth[] = [
  { name: "lemgendary-env-manager", project_dir: "./lemgendary-env-manager", venv_exists: false, total_required: 0, total_installed: 0, missing_packages: [], installed_packages: {}, is_healthy: false },
  { name: "lemgendary-datasets", project_dir: "./lemgendary-datasets", venv_exists: false, total_required: 0, total_installed: 0, missing_packages: [], installed_packages: {}, is_healthy: false },
  { name: "lemgendary-training-suite", project_dir: "./lemgendary-training-suite", venv_exists: false, total_required: 0, total_installed: 0, missing_packages: [], installed_packages: {}, is_healthy: false },
  { name: "lemgendary-ai-studio-gui", project_dir: "./lemgendary-ai-studio-gui", venv_exists: false, total_required: 0, total_installed: 0, missing_packages: [], installed_packages: {}, is_healthy: false },
  { name: "lemgendary-docs", project_dir: "./lemgendary-docs", venv_exists: false, total_required: 0, total_installed: 0, missing_packages: [], installed_packages: {}, is_healthy: false },
];

export const App: React.FC = () => {
  const currentTab = useStudioStore((s) => s.currentTab);
  const setCurrentTab = useStudioStore((s) => s.setCurrentTab);
  const hardware = useStudioStore((s) => s.hardware);
  const setHardware = useStudioStore((s) => s.setHardware);
  const health = useStudioStore((s) => s.health);
  const setHealth = useStudioStore((s) => s.setHealth);
  const events = useStudioStore((s) => s.events);
  const setEvents = useStudioStore((s) => s.setEvents);
  const clearEvents = useStudioStore((s) => s.clearEvents);
  const isRunningPipeline = useStudioStore((s) => s.isRunningPipeline);
  const setIsRunningPipeline = useStudioStore((s) => s.setIsRunningPipeline);
  const wsConnected = useStudioStore((s) => s.wsConnected);
  const setWsConnected = useStudioStore((s) => s.setWsConnected);
  const meshStatus = useStudioStore((s) => s.meshStatus);
  const setMeshStatus = useStudioStore((s) => s.setMeshStatus);

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const runningSingleStepRef = useRef<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const initialModal = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("modal") : null;
  const [isConfigEditorOpen, setIsConfigEditorOpen] = useState<boolean>(initialModal === "config" || initialModal === "secrets");
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const displayProjects = health?.projects ?? FALLBACK_PROJECTS;

  const refreshMeshStatus = useCallback(async () => {
    let newMesh: MeshStatus;
    try {
      const mesh = await fetchEcosystemMesh();
      newMesh = {
        envManager: mesh.env_manager.reachable,
        datasetCompiler: mesh.dataset_compiler.reachable,
        trainingSuite: mesh.training_suite.reachable,
      };
      setMeshStatus(newMesh);
      return true;
    } catch {
      const [em, dc, ts] = await Promise.all([
        probeSidecarPort("env-manager"),
        probeSidecarPort("dataset-compiler"),
        probeSidecarPort("training-suite"),
      ]);
      newMesh = { envManager: em, datasetCompiler: dc, trainingSuite: ts };
      setMeshStatus(newMesh);
      return em || dc || ts;
    }
  }, [setMeshStatus]);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    // Refresh mesh status immediately (<100ms) so sidecar cards are instantly accurate
    void refreshMeshStatus();

    try {
      const [hwData, healthData, pipeStatus] = await Promise.all([
        fetchHardware().catch(() => null),
        fetchHealth().catch(() => null),
        fetchPipelineStatus().catch(() => null),
      ]);

      if (hwData) {
        setHardware(hwData);
      }
      if (healthData) {
        setHealth(healthData);
      }
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

      await refreshMeshStatus();
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
  }, [refreshMeshStatus, setEvents, setHardware, setHealth, setIsRunningPipeline]);

  useEffect(() => {
    loadData();

    // Periodic lightweight mesh poll (every 4 seconds) to ensure sidecar transitions are always live
    const meshInterval = setInterval(() => {
      void refreshMeshStatus();
    }, 4000);

    const cleanupWs = createLogWebSocket(
      (ev) => {
        setEvents((prev) => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const isCurrProgress = Boolean(ev.is_progress || isProgressLine(ev.message));
            const wasLastProgress = Boolean(last.is_progress || isProgressLine(last.message));
            if (isCurrProgress && wasLastProgress && last.step_name === ev.step_name) {
              const next = [...prev];
              next[next.length - 1] = ev;
              return next;
            }
          }
          return [...prev.slice(-199), ev];
        });

        const msg = typeof ev.message === "string" ? ev.message.toLowerCase() : "";
        const isStep7Terminal =
          (ev.step_name === "Health Matrix" || ev.step_number === 7) &&
          (ev.status === "success" || ev.status === "warning" || ev.status === "error");
        const isPipelineTerminal =
          ev.step_name === "Pipeline Error" ||
          isStep7Terminal ||
          msg.includes("pipeline execution completed") ||
          msg.includes("ecosystem healthy status");

        const targetStep = runningSingleStepRef.current;
        const isSingleStepTerminal =
          targetStep !== null &&
          ev.step_number === targetStep &&
          (ev.status === "success" || ev.status === "warning" || ev.status === "error") &&
          !ev.is_progress;

        if (isPipelineTerminal || isSingleStepTerminal) {
          setIsRunningPipeline(false);
          runningSingleStepRef.current = null;
          void loadData();
        }
      },
      (connected) => {
        setWsConnected(connected);
      }
    );

    return () => {
      clearInterval(meshInterval);
      cleanupWs();
    };
  }, [loadData, refreshMeshStatus, setEvents, setIsRunningPipeline, setWsConnected]);

  // Safety polling to guarantee UI state termination when pipeline or step finishes
  useEffect(() => {
    if (!isRunningPipeline) return;
    const pollInterval = setInterval(async () => {
      try {
        const pipeStatus = await fetchPipelineStatus();
        if (pipeStatus && !pipeStatus.is_running) {
          setIsRunningPipeline(false);
          runningSingleStepRef.current = null;
          void loadData();
        }
      } catch {
        // Polling error ignored during active pipeline execution
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [isRunningPipeline, loadData, setIsRunningPipeline]);

  // Auto-start any offline sidecars on GUI startup
  useEffect(() => {
    let cancelled = false;
    const autoStartOffline = async () => {
      // Grace period for initial local network and server hydration
      await new Promise((resolve) => setTimeout(resolve, 1200));
      if (cancelled) return;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const mesh = await fetchEcosystemMesh();
          if (cancelled) return;
          const needsStart = !mesh.dataset_compiler.reachable || !mesh.training_suite.reachable;
          if (needsStart) {
            await startAllServices();
            if (cancelled) return;
            // Poll mesh status until all sidecars report ready
            for (let i = 0; i < 15; i++) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              if (cancelled) return;
              await refreshMeshStatus();
              const check = await fetchEcosystemMesh().catch(() => null);
              if (check?.dataset_compiler.reachable && check?.training_suite.reachable) {
                break;
              }
            }
            await loadData();
          }
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    };

    void autoStartOffline();
    return () => {
      cancelled = true;
    };
  }, [loadData, refreshMeshStatus]);

  const handleRunPipeline = async () => {
    try {
      runningSingleStepRef.current = null;
      setIsRunningPipeline(true);
      await triggerPipeline();
    } catch {
      setRefreshError("Pipeline trigger failed: Environment Manager (Port 8000) is not reachable.");
      setIsRunningPipeline(false);
    }
  };

  const handleReconcileProject = async (projectName: string) => {
    try {
      runningSingleStepRef.current = null;
      setIsRunningPipeline(true);
      await triggerPipeline(projectName);
    } catch {
      setRefreshError(`Reconcile failed for ${projectName}: Environment Manager (Port 8000) is not reachable.`);
      setIsRunningPipeline(false);
    }
  };

  const handleRunPipelineStep = async (stepNumber: number) => {
    try {
      runningSingleStepRef.current = stepNumber;
      setIsRunningPipeline(true);
      await triggerPipelineStep(stepNumber);
    } catch {
      setRefreshError(`Failed to trigger Step ${stepNumber}: Environment Manager (Port 8000) is not reachable.`);
      runningSingleStepRef.current = null;
      setIsRunningPipeline(false);
    }
  };


  const [startingServiceId, setStartingServiceId] = useState<string | null>(null);
  const [stoppingServiceId, setStoppingServiceId] = useState<string | null>(null);

  const handleStartService = async (serviceId: string) => {
    try {
      setStartingServiceId(serviceId);
      setRefreshError(null);

      await startService(serviceId);

      // Poll mesh status for up to 15 seconds to confirm readiness
      for (let i = 0; i < 15; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await refreshMeshStatus();
        const check = await fetchEcosystemMesh().catch(() => null);
        if (serviceId === "env-manager" && check?.env_manager?.reachable) break;
        if (serviceId === "dataset-compiler" && check?.dataset_compiler?.reachable) break;
        if (serviceId === "training-suite" && check?.training_suite?.reachable) break;
      }
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRefreshError(`Failed to start ${serviceId}: ${message}`);
    } finally {
      setStartingServiceId(null);
    }
  };

  const handleStopService = async (serviceId: string) => {
    try {
      setStoppingServiceId(serviceId);
      setRefreshError(null);

      await stopService(serviceId);

      // Poll mesh status to confirm offline state
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await refreshMeshStatus();
        const check = await fetchEcosystemMesh().catch(() => null);
        if (serviceId === "env-manager" && !check?.env_manager?.reachable) break;
        if (serviceId === "dataset-compiler" && !check?.dataset_compiler?.reachable) break;
        if (serviceId === "training-suite" && !check?.training_suite?.reachable) break;
      }
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRefreshError(`Failed to stop ${serviceId}: ${message}`);
    } finally {
      setStoppingServiceId(null);
    }
  };

  const handleStartAllServices = async () => {
    try {
      setStartingServiceId("all");
      setRefreshError(null);

      await startAllServices();

      // Poll mesh status for up to 15 seconds to confirm all 3 sidecars report ready
      for (let i = 0; i < 15; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await refreshMeshStatus();
        const check = await fetchEcosystemMesh().catch(() => null);
        if (check?.dataset_compiler?.reachable && check?.training_suite?.reachable) {
          break;
        }
      }
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
        return "LemGendary Dataset Compiler Suite";
      case "training":
        return "LemGendary Model Training Suite";
      case "pipeline":
        return "Smart Clean Install Pipeline";
      case "health":
        return "Health & Version Drift Matrix";
      default:
        return "LemGendary AI Studio GUI";
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
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: "11px", padding: "2px 10px" }}
                  onClick={() => setRefreshError(null)}
                  aria-label="Dismiss error message"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {currentTab === "dashboard" && (
            <>
              <ServiceTiles
                meshStatus={meshStatus}
                onNavigate={setCurrentTab}
                onRunAudit={handleRunPipeline}
                onStartService={handleStartService}
                onStopService={handleStopService}
                startingServiceId={startingServiceId}
                stoppingServiceId={stoppingServiceId}
              />

              <div className="card-grid card-grid-dashboard">
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
                onClear={clearEvents}
                isConnected={wsConnected}
              />
            </>
          )}

          {currentTab === "datasets" && (
            <>
              <CompilerPanel datasetCompilerOnline={meshStatus.datasetCompiler} />
              <LogPanel
                events={events.filter(isCompilerEvent)}
                onClear={() => setEvents((prev) => prev.filter((e) => !isCompilerEvent(e)))}
                isConnected={wsConnected}
              />
            </>
          )}

          {currentTab === "training" && (
            <TrainingPanel
              trainingSuiteOnline={meshStatus.trainingSuite}
              onOpenConfigEditor={() => setIsConfigEditorOpen(true)}
              onStartTrainingSuite={() => handleStartService("training-suite")}
              recentEvents={events}
              logSlot={
                <LogPanel
                  events={events}
                  onClear={clearEvents}
                  isConnected={wsConnected}
                />
              }
            />
          )}

          {currentTab === "pipeline" && (
            <>
              <PipelinePanel
                isRunning={isRunningPipeline}
                onRunPipeline={handleRunPipeline}
                recentEvents={events}
                envManagerOnline={meshStatus.envManager}
              />
              <PipelineStepCards
                isRunning={isRunningPipeline}
                activeStepNum={
                  events.length > 0 && isRunningPipeline
                    ? events[events.length - 1].step_number
                    : null
                }
                onRunStep={handleRunPipelineStep}
                recentEvents={events}
                envManagerOnline={meshStatus.envManager}
              />
              <LogPanel
                events={events}
                onClear={clearEvents}
                isConnected={wsConnected}
              />
            </>
          )}

          {currentTab === "health" && (
            <>
              <HealthPanel report={health} onStartEnvManager={() => handleStartService("env-manager")} />
              <LogPanel
                events={events}
                onClear={clearEvents}
                isConnected={wsConnected}
              />
            </>
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
