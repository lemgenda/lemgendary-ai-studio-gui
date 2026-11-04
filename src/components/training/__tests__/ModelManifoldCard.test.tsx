import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { ModelManifoldCard } from "../ModelManifoldCard";
import { ModelItem } from "../../../api/types";

/** Sidecar-shaped records (`ModelWithStats`); the GUI ships no offline model catalog. */
const LLM_MODEL: ModelItem = {
  key: "ai_helper_lemgend",
  display_name: "LemGendary AI Studio Assistant (Causal LLM)",
  architecture: "Causal Decoder Transformer (QLoRA Fine-Tuned)",
  task_type: "llm",
  category: "llm",
  canonical_format: "jsonl",
  is_llm: true,
  ladder_type: "context_tokens",
  target_res: 2048,
  training_status: "initializing",
  is_fully_trained: false,
};

const FOREX_MODEL: ModelItem = {
  key: "forex_predictor",
  display_name: "LemGendary Forex Predictor (Multi-Scale CNN-Transformer)",
  architecture: "Multi-Scale CNN-Transformer (Causal TCN + Cross-Timeframe Attention)",
  task_type: "forex",
  category: "forex",
  canonical_format: "parquet",
  is_forex: true,
  ladder_type: "timeframe",
  active_fold: 1,
  total_folds: 6,
  training_status: "initializing",
  is_fully_trained: false,
};

describe("ModelManifoldCard", () => {
  const noop = vi.fn();

  it("renders LLM / Causal Assistant card with Context Window and LemGendizedAIHelperLemGend telemetry", () => {
    const html = renderToStaticMarkup(
      <ModelManifoldCard
        model={LLM_MODEL}
        isCurrentlyTrainingThis={false}
        isBusy={false}
        actionBusyKey={null}
        trainingSuiteOnline={true}
        isTargetPinned={false}
        onToggleTargetPin={noop}
        generatingNotebookModel={null}
        onStartLocalTrain={noop}
        onStopLocalTrain={noop}
        onOpenCloudModal={noop}
        onPushArtifacts={noop}
        onPullArtifacts={noop}
        onGenerateTrainingNotebook={noop}
        onGenerateUsageNotebook={noop}
        onEvaluateModel={noop}
        onExportModel={noop}
        onGenerateDocs={noop}
        onStageVariations={noop}
      />
    );

    expect(html).toContain("QLoRA Instruction Tuning Matrix");
    expect(html).toContain("Context Window");
    expect(html).toContain("2048 tokens (Full)");
    expect(html).toContain("LemGendizedAIHelperLemGend");
    expect(html).toContain('id="train-btn-start-ai_helper_lemgend"');
    expect(html).toContain('id="train-btn-eval-ai_helper_lemgend"');
    expect(html).toContain('id="train-btn-export-ai_helper_lemgend"');
  });

  it("renders Forex Predictor card with Walk-Forward Fold telemetry", () => {
    const html = renderToStaticMarkup(
      <ModelManifoldCard
        model={FOREX_MODEL}
        isCurrentlyTrainingThis={false}
        isBusy={false}
        actionBusyKey={null}
        trainingSuiteOnline={true}
        isTargetPinned={false}
        onToggleTargetPin={noop}
        generatingNotebookModel={null}
        onStartLocalTrain={noop}
        onStopLocalTrain={noop}
        onOpenCloudModal={noop}
        onPushArtifacts={noop}
        onPullArtifacts={noop}
        onGenerateTrainingNotebook={noop}
        onGenerateUsageNotebook={noop}
        onEvaluateModel={noop}
        onExportModel={noop}
        onGenerateDocs={noop}
        onStageVariations={noop}
      />
    );

    expect(html).toContain("Confluence Ladder");
    expect(html).toContain("Walk-Forward Fold");
    expect(html).toContain("Fold 1 / 6");
    expect(html).toContain('id="train-btn-start-forex_predictor"');
  });

  it("shows the sidecar's unknown status with its reason and no fabricated ladder or metrics", () => {
    const placeholder: ModelItem = {
      key: "upn_v2",
      display_name: "LemGendary UPN v2 Parameter Predictor",
      architecture: "MobileNetV3-Small Parameter Regressor",
      task_type: "enhance",
      epochs_completed: 12,
      training_status: "unknown",
      is_fully_trained: false,
      stats_error: "metrics.csv unreadable",
    };
    const html = renderToStaticMarkup(
      <ModelManifoldCard
        model={placeholder}
        isCurrentlyTrainingThis={false}
        isBusy={false}
        actionBusyKey={null}
        trainingSuiteOnline={false}
        isTargetPinned={false}
        onToggleTargetPin={noop}
        generatingNotebookModel={null}
        onStartLocalTrain={noop}
        onStopLocalTrain={noop}
        onOpenCloudModal={noop}
        onPushArtifacts={noop}
        onPullArtifacts={noop}
        onGenerateTrainingNotebook={noop}
        onGenerateUsageNotebook={noop}
        onEvaluateModel={noop}
        onExportModel={noop}
        onGenerateDocs={noop}
        onStageVariations={noop}
      />
    );
    expect(html).toContain("UNKNOWN");
    expect(html).toContain("metrics.csv unreadable");
    expect(html).not.toContain("PARTIALLY TRAINED");
    expect(html).not.toContain("INITIALIZING");
    expect(html).not.toContain("256px");
    expect(html).not.toContain("512px");
  });
});
