import { describe, it, expect, vi, afterEach } from "vitest";
import {
  cleanAnsiAndControlChars,
  isProgressLine,
  rollupTelemetryEvents,
  fetchModels,
  MESH_SERVICES,
} from "../client";
import { PipelineEvent } from "../types";

describe("API Client & Telemetry Utilities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes SSOT MESH_SERVICES registry for all 3 sidecars", () => {
    expect(MESH_SERVICES["env-manager"].defaultPort).toBe(8000);
    expect(MESH_SERVICES["dataset-compiler"].defaultPort).toBe(8100);
    expect(MESH_SERVICES["training-suite"].defaultPort).toBe(8200);
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
});
