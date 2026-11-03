import { describe, it, expect, vi, afterEach } from "vitest";
import {
  cleanAnsiAndControlChars,
  isProgressLine,
  rollupTelemetryEvents,
  fetchModels,
  MESH_SERVICES,
  triggerPipeline,
  triggerPipelineStep,
  runTrainingUnitTests,
  runDatasetTestSuite,
} from "../client";
import { PipelineEvent } from "../types";
import { ecosystemService } from "../ecosystem";

describe("API Client & Telemetry Utilities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes SSOT MESH_SERVICES registry for all 3 sidecars", () => {
    for (const id of ["env-manager", "dataset-compiler", "training-suite"] as const) {
      expect(MESH_SERVICES[id].defaultPort).toBe(ecosystemService(id).port);
    }
  });

  it("strips ANSI escape sequences, carriage returns, and ASCII progress bars in cleanAnsiAndControlChars", () => {
    const raw =
      "Epoch 1/10 |==========|\r\u001b[32m[PROGRESS] 50% | Epoch 5/10 | Loss=0.142\u001b[0m";
    const cleaned = cleanAnsiAndControlChars(raw);
    expect(cleaned).toBe("[PROGRESS] 50% | Epoch 5/10 | Loss=0.142");
  });

  it("identifies progress lines accurately via isProgressLine", () => {
    expect(isProgressLine("[BATCH 12/100] loss=0.042")).toBe(true);
    expect(isProgressLine("75%|████████  | 750/1000 [00:10<00:03, 75.0it/s]")).toBe(true);
    expect(isProgressLine("Installing requirements for lemgendary-training-suite")).toBe(true);
    expect(isProgressLine("Checkpoint saved to best.pth")).toBe(false);
  });

  it("rolls up consecutive progress events from the same step and origin while preserving milestones", () => {
    const events: PipelineEvent[] = [
      {
        step_number: 4,
        total_steps: 7,
        step_name: "Training",
        status: "info",
        message: "[BATCH 1/10] loss=0.5",
        timestamp: "2026-10-28T10:00:00Z",
        origin: "training-suite",
      },
      {
        step_number: 4,
        total_steps: 7,
        step_name: "Training",
        status: "info",
        message: "[BATCH 2/10] loss=0.4",
        timestamp: "2026-10-28T10:00:01Z",
        origin: "training-suite",
      },
      {
        step_number: 4,
        total_steps: 7,
        step_name: "Training",
        status: "success",
        message: "Epoch 1 completed. Checkpoint saved.",
        timestamp: "2026-10-28T10:00:02Z",
        origin: "training-suite",
      },
    ];

    const rolled = rollupTelemetryEvents(events);
    expect(rolled).toHaveLength(2);
    expect(rolled[0].message).toBe("[BATCH 2/10] loss=0.4");
    expect(rolled[1].message).toBe("Epoch 1 completed. Checkpoint saved.");
  });

  it("normalizes Vision, Forex, and LLM models in fetchModels", async () => {
    const mockBackendModels = [
      {
        model_key: "mirnet_lowlight",
        name: "LemGendary MIRNet v2 Low-Light Enhancement",
        category: "restoration",
        spatial_ladder: [256, 384, 512],
        ladder_type: "spatial",
        is_forex: false,
        is_llm: false,
        epochs_completed: 25,
        sota_reached: true,
        ladder_passed: true,
        data_fraction_completed: 1.0,
        data_fraction_passed: true,
        is_fully_trained: true,
      },
      {
        model_key: "forex_predictor",
        name: "LemGendary Forex Predictor",
        category: "forex",
        spatial_ladder: [1, 5, 15, 60, 240, 1440],
        ladder_type: "timeframe",
        is_forex: true,
        is_llm: false,
        active_fold: 4,
        total_folds: 6,
      },
      {
        model_key: "ai_helper_lemgend",
        name: "LemGendary AI Studio Assistant (Causal LLM)",
        category: "llm",
        spatial_ladder: [2048],
        ladder_type: "context_tokens",
        is_forex: false,
        is_llm: true,
        parameters_m: 1500.0,
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/gui/models/with-stats")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBackendModels),
          });
        }
        return Promise.resolve({ ok: false });
      })
    );

    const models = await fetchModels();
    expect(models).toHaveLength(3);

    const vision = models.find((m) => m.key === "mirnet_lowlight");
    expect(vision?.ladder_type).toBe("spatial");
    expect(vision?.is_fully_trained).toBe(true);

    const forex = models.find((m) => m.key === "forex_predictor");
    expect(forex?.is_forex).toBe(true);
    expect(forex?.ladder_type).toBe("timeframe");
    expect(forex?.active_fold).toBe(4);
    expect(forex?.total_folds).toBe(6);

    const llm = models.find((m) => m.key === "ai_helper_lemgend");
    expect(llm?.is_llm).toBe(true);
    expect(llm?.ladder_type).toBe("context_tokens");
    expect(llm?.parameters_m).toBe(1500.0);
  });
  it("keeps null parameters_m, best_metric and other unknown numbers as null in fetchModels", async () => {
    const mockBackendModels = [
      {
        model_key: "unknown_model",
        name: "Unknown Model",
        training_status: "unknown",
        is_fully_trained: false,
        parameters_m: null,
        best_checkpoint_size_mb: null,
        best_metric: null,
        sota_target: null,
        learning_rate: null,
        batch_size: null,
        default_epochs: null,
        sota_details: [
          { key: "psnr", label: "PSNR", target: null, achieved: null, lower_is_better: false, passed: false },
        ],
        best_metrics_details: [
          { key: "psnr", label: "PSNR", value: null, target: null, lower_is_better: false, passed: false },
        ],
      },
      {
        model_key: "tiny_model",
        name: "Tiny Model",
        training_status: "initializing",
        is_fully_trained: false,
        parameters_m: 0,
        best_metric: 0,
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockBackendModels) })
    );

    const [unknown, tiny] = await fetchModels();
    expect(unknown.parameters_m).toBeNull();
    expect(unknown.best_metric).toBeNull();
    expect(unknown.sota_target).toBeNull();
    expect(unknown.learning_rate).toBeUndefined();
    expect(unknown.batch_size).toBeUndefined();
    expect(unknown.default_epochs).toBeUndefined();
    expect(unknown.sota_details?.[0].target).toBeNull();
    expect(unknown.best_metrics_details?.[0].value).toBeNull();
    expect(unknown.best_metrics_details?.[0].target).toBeNull();
    // 0 is a known value, not "unknown".
    expect(tiny.parameters_m).toBe(0);
    expect(tiny.best_metric).toBe(0);
  });

  it("always sends an explicit clean flag for project and single-step runs", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ status: "accepted" })));
    vi.stubGlobal("fetch", fetchMock);

    await triggerPipeline({ clean: false, targetProject: "lemgendary-datasets" });
    await triggerPipelineStep(3, false);

    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    expect(bodies).toEqual([
      { target_project: "lemgendary-datasets", clean: false },
      { step_number: 3, target_project: null, clean: false },
    ]);
    vi.unstubAllGlobals();
  });
  it("builds unit test run URLs from the mesh service registry", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ status: "passed", tests_run: 2, failures_count: 0, errors_count: 0, failures: [], errors: [] }))
    );
    vi.stubGlobal("fetch", fetchMock);

    const training = await runTrainingUnitTests();
    await runDatasetTestSuite({ pattern: "test_chunker*.py" });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${MESH_SERVICES["training-suite"].httpUrl}/api/training/unit-test-run`,
      `${MESH_SERVICES["dataset-compiler"].httpUrl}/api/llm/test-suite`,
    ]);
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    expect(bodies).toEqual([{ pattern: "test_*.py" }, { pattern: "test_chunker*.py" }]);
    expect(training.tests_run).toBe(2);
    vi.unstubAllGlobals();
  });

  it("rejects with the HTTP status when a unit test run fails", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response("", { status: 503 })));
    await expect(runDatasetTestSuite()).rejects.toThrow("Dataset Compiler test suite returned HTTP 503");
    vi.unstubAllGlobals();
  });
});
