import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { ModelManifoldCard } from "../ModelManifoldCard";
import { FALLBACK_MODELS } from "../fallbackModels";
import { FALLBACK_DATASETS } from "../../compiler/fallbackDatasets";

describe("ModelManifoldCard & Canonical Registries", () => {
  const noop = vi.fn();

  it("contains all 23 canonical models in FALLBACK_MODELS and 21 datasets in FALLBACK_DATASETS", () => {
    expect(FALLBACK_MODELS).toHaveLength(23);
    expect(FALLBACK_DATASETS).toHaveLength(21);

    const llmModel = FALLBACK_MODELS.find((m) => m.key === "ai_helper_lemgend");
    expect(llmModel).toBeDefined();
    expect(llmModel?.is_llm).toBe(true);
    expect(llmModel?.ladder_type).toBe("context_tokens");
  });

  it("renders LLM / Causal Assistant card with Context Window and LemGendizedAIHelperLemGend telemetry", () => {
    const llmModel = FALLBACK_MODELS.find((m) => m.key === "ai_helper_lemgend")!;
    const html = renderToStaticMarkup(
      <ModelManifoldCard
        model={llmModel}
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
    const forexModel = FALLBACK_MODELS.find((m) => m.key === "forex_predictor")!;
    const html = renderToStaticMarkup(
      <ModelManifoldCard
        model={forexModel}
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
});
