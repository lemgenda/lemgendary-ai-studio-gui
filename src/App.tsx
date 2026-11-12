import React from "react";
import { useStudioStore } from "./store/useStudioStore";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { HardwareCard } from "./components/HardwareCard";
import { ProjectCard } from "./components/ProjectCard";
import { HealthPanel } from "./components/HealthPanel";
import { StatusBar } from "./components/StatusBar";
import { CompilerPanel } from "./components/CompilerPanel";
import { TrainingPanel } from "./components/TrainingPanel";
import { ConfigEditorModal } from "./components/ConfigEditorModal";
import { TestModal } from "./components/TestModal";
import { BugReportModal } from "./components/bugReport/BugReportModal";
import { ServiceTiles } from "./components/ServiceTiles";
import { HelpTooltip } from "./components/HelpTooltip";
import { MeshOfflineBanner, RefreshErrorBanner } from "./components/MeshBanners";
import { isCompilerEvent } from "./api/client";
import { workspaceTabTitle } from "./navigation/workspaceTabs";
import { FALLBACK_PROJECTS } from "./app/fallbackProjects";
import { useMeshSync } from "./app/useMeshSync";
import { useServiceControls } from "./app/useServiceControls";
import { usePipelineControls } from "./app/usePipelineControls";
import { LiveLogPanel, LivePipelinePanel, LivePipelineStepCards } from "./app/liveViews";

export const App: React.FC = () => {
  const currentTab = useStudioStore((s) => s.currentTab);
  const setCurrentTab = useStudioStore((s) => s.setCurrentTab);
  const hardware = useStudioStore((s) => s.hardware);
  const health = useStudioStore((s) => s.health);
  const isRunningPipeline = useStudioStore((s) => s.isRunningPipeline);
  const meshStatus = useStudioStore((s) => s.meshStatus);
  const addTelemetryLog = useStudioStore((s) => s.addTelemetryLog);
  const activeModal = useStudioStore((s) => s.activeModal);
  const openModal = useStudioStore((s) => s.openModal);
  const closeModal = useStudioStore((s) => s.closeModal);

  const { loadData, refreshMeshStatus, isRefreshing, lastUpdated, refreshError, setRefreshError } = useMeshSync();
  const { startingServiceId, stoppingServiceId, handleStartService, handleStopService, handleStartAllServices } =
    useServiceControls({ refreshMeshStatus, loadData, setRefreshError });
  const { handleRunPipeline, handleReconcileProject, handleRunPipelineStep } = usePipelineControls({ setRefreshError });

  const displayProjects = health?.projects ?? FALLBACK_PROJECTS;

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
          title={workspaceTabTitle(currentTab)}
          onRefresh={loadData}
          isRefreshing={isRefreshing}
          onOpenConfigEditor={() => openModal("config")}
          onOpenTestModal={() => openModal("tests")}
          onOpenBugReport={() => openModal("bug-report")}
          envManagerOnline={meshStatus.envManager}
        />

        <main
          id="main-content"
          className="view-container"
          aria-labelledby={`tab-${currentTab}`}
          tabIndex={-1}
        >
          {/* Global offline banner — shown across all tabs when entire mesh is down */}
          {!meshStatus.envManager && !meshStatus.datasetCompiler && !meshStatus.trainingSuite && (
            <MeshOfflineBanner startingServiceId={startingServiceId} onStartAll={handleStartAllServices} />
          )}

          {/* Dismissible refresh error banner */}
          {refreshError && <RefreshErrorBanner message={refreshError} onDismiss={() => setRefreshError(null)} />}

          {currentTab === "dashboard" && (
            <>
              <ServiceTiles
                meshStatus={meshStatus}
                onNavigate={setCurrentTab}
                onRunAudit={() => handleRunPipeline(false)}
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
                <LivePipelinePanel onRunPipeline={handleRunPipeline} />
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

              <LiveLogPanel />
            </>
          )}

          {currentTab === "datasets" && (
            <>
              <CompilerPanel datasetCompilerOnline={meshStatus.datasetCompiler} />
              <LiveLogPanel filter={isCompilerEvent} />
            </>
          )}

          {currentTab === "training" && (
            <TrainingPanel
              trainingSuiteOnline={meshStatus.trainingSuite}
              onOpenConfigEditor={() => openModal("config")}
              onStartTrainingSuite={() => handleStartService("training-suite")}
              logSlot={<LiveLogPanel />}
            />
          )}

          {currentTab === "pipeline" && (
            <>
              <LivePipelinePanel onRunPipeline={handleRunPipeline} />
              <LivePipelineStepCards onRunStep={handleRunPipelineStep} />
              <LiveLogPanel />
            </>
          )}

          {currentTab === "health" && (
            <>
              <HealthPanel report={health} onStartEnvManager={() => handleStartService("env-manager")} />
              <LiveLogPanel />
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
        isOpen={activeModal === "config"}
        onClose={closeModal}
      />
      <TestModal
        isOpen={activeModal === "tests"}
        onClose={closeModal}
        trainingSuiteOnline={meshStatus.trainingSuite}
        datasetCompilerOnline={meshStatus.datasetCompiler}
        onLogMessage={addTelemetryLog}
      />
      <BugReportModal
        isOpen={activeModal === "bug-report"}
        onClose={closeModal}
      />
    </div>
  );
};

export default App;
