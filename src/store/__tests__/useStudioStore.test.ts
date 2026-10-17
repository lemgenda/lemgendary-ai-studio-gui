import { describe, it, expect, beforeEach } from "vitest";
import { useStudioStore } from "../useStudioStore";

describe("useStudioStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useStudioStore.setState({
      currentTab: "models",
      meshStatus: {
        envManager: false,
        datasetCompiler: false,
        trainingSuite: false,
      },
      hardware: null,
      health: null,
      localJob: { jobId: null, modelKey: null },
      remoteJob: { jobId: null, modelKey: null },
      cachedModels: [],
      cachedDatasets: [],
      events: [],
      wsConnected: false,
      isRunningPipeline: false,
      notification: null,
    });
  });

  it("updates navigation tab", () => {
    const { setCurrentTab } = useStudioStore.getState();
    setCurrentTab("datasets");
    expect(useStudioStore.getState().currentTab).toBe("datasets");
  });

  it("updates tripartite sidecar mesh status", () => {
    const { setMeshStatus } = useStudioStore.getState();
    setMeshStatus({
      envManager: true,
      datasetCompiler: true,
      trainingSuite: true,
    });
    const { meshStatus } = useStudioStore.getState();
    expect(meshStatus.envManager).toBe(true);
    expect(meshStatus.datasetCompiler).toBe(true);
    expect(meshStatus.trainingSuite).toBe(true);
  });

  it("tracks active local and remote training jobs", () => {
    const { setLocalJob, setRemoteJob } = useStudioStore.getState();
    setLocalJob({ jobId: "job_local_123", modelKey: "mirnet_exposure" });
    setRemoteJob({ jobId: "job_kaggle_456", modelKey: "nafnet_debluring" });

    const state = useStudioStore.getState();
    expect(state.localJob.jobId).toBe("job_local_123");
    expect(state.localJob.modelKey).toBe("mirnet_exposure");
    expect(state.remoteJob.jobId).toBe("job_kaggle_456");
    expect(state.remoteJob.modelKey).toBe("nafnet_debluring");
  });

  it("buffers telemetry events and supports clearing", () => {
    const { addTelemetryLog, clearEvents } = useStudioStore.getState();
    addTelemetryLog("Beginning telemetry broadcast", "info");
    addTelemetryLog("SOTA targets achieved", "success");

    let events = useStudioStore.getState().events;
    expect(events.length).toBe(2);
    expect(events[0].message).toBe("Beginning telemetry broadcast");
    expect(events[1].status).toBe("success");

    clearEvents();
    events = useStudioStore.getState().events;
    expect(events.length).toBe(0);
  });
});
