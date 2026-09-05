import React, { useEffect, useState, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { HardwareCard } from "./components/HardwareCard";
import { ProjectCard } from "./components/ProjectCard";
import { PipelinePanel } from "./components/PipelinePanel";
import { HealthPanel } from "./components/HealthPanel";
import { LogPanel } from "./components/LogPanel";
import { StatusBar } from "./components/StatusBar";
import {
  fetchHardware,
  fetchHealth,
  fetchPipelineStatus,
  triggerPipeline,
  createLogWebSocket,
} from "./api/client";
import { HardwareProfile, HealthAuditReport, PipelineEvent } from "./api/types";

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>("dashboard");
  const [hardware, setHardware] = useState<HardwareProfile | null>(null);
  const [health, setHealth] = useState<HealthAuditReport | null>(null);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isRunningPipeline, setIsRunningPipeline] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

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
      setLastUpdated(new Date().toISOString());
    } catch {
      // Handled via state
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
      setIsRunningPipeline(false);
    }
  };

  const handleReconcileProject = async (projectName: string) => {
    try {
      setIsRunningPipeline(true);
      await triggerPipeline(projectName);
    } catch {
      setIsRunningPipeline(false);
    }
  };

  const getHeaderTitle = () => {
    switch (currentTab) {
      case "dashboard":
        return "Ecosystem Control Dashboard";
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
      <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />

      <div className="main-content">
        <Header
          title={getHeaderTitle()}
          onRefresh={loadData}
          isRefreshing={isRefreshing}
        />

        <main className="view-container">
          {currentTab === "dashboard" && (
            <>
              <div className="card-grid">
                <HardwareCard hardware={hardware} />
                <PipelinePanel
                  isRunning={isRunningPipeline}
                  onRunPipeline={handleRunPipeline}
                  recentEvents={events}
                />
              </div>

              <div>
                <h3 style={{ fontSize: "16px", marginBottom: "16px" }}>Managed Projects</h3>
                <div className="card-grid">
                  {health?.projects.map((p) => (
                    <ProjectCard
                      key={p.name}
                      project={p}
                      onInstall={handleReconcileProject}
                      isProcessing={isRunningPipeline}
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

          {currentTab === "pipeline" && (
            <>
              <PipelinePanel
                isRunning={isRunningPipeline}
                onRunPipeline={handleRunPipeline}
                recentEvents={events}
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
              {health?.projects.map((p) => (
                <ProjectCard
                  key={p.name}
                  project={p}
                  onInstall={handleReconcileProject}
                  isProcessing={isRunningPipeline}
                />
              ))}
            </div>
          )}

          {currentTab === "health" && <HealthPanel report={health} />}

          {currentTab === "logs" && (
            <LogPanel
              events={events}
              onClear={() => setEvents([])}
              isConnected={wsConnected}
            />
          )}
        </main>

        <StatusBar
          isConnected={wsConnected}
          backend={hardware?.primary_backend || "unknown"}
          projectCount={health?.projects.length || 0}
          lastUpdated={lastUpdated}
        />
      </div>
    </div>
  );
};

export default App;
