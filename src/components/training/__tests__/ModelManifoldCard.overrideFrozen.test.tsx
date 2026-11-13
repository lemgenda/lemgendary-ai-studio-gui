// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelManifoldCard } from "../ModelManifoldCard";
import { ModelItem } from "../../../api/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const VISION: ModelItem = {
  key: "upn_v2",
  display_name: "UPN v2",
  architecture: "MobileNetV3",
  task_type: "enhance",
  batch_size: 8,
  is_fully_trained: false,
  training_status: "partially_trained",
};

const LLM: ModelItem = { ...VISION, key: "ai_helper_lemgend", display_name: "AI Helper", task_type: "llm", is_llm: true };

describe("ModelManifoldCard frozen settings override", () => {
  let container: HTMLDivElement;
  let root: Root;
  const noop = (): void => undefined;

  const render = (model: ModelItem, onStartLocalTrain = vi.fn()) => {
    act(() =>
      root.render(
        <ModelManifoldCard
          model={model}
          isCurrentlyTrainingThis={false}
          isBusy={false}
          actionBusyKey={null}
          trainingSuiteOnline
          isTargetPinned={false}
          onToggleTargetPin={noop}
          generatingNotebookModel={null}
          onStartLocalTrain={onStartLocalTrain}
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
          onOpenSoupDialog={noop}
        />
      )
    );
    return onStartLocalTrain;
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("starts unchecked and sends the override with the local launch once checked", () => {
    const onStart = render(VISION);
    const toggle = document.getElementById("train-input-override-frozen-upn_v2") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    act(() => document.getElementById("train-btn-start-upn_v2")?.click());
    expect(onStart).toHaveBeenLastCalledWith(VISION, { batchSize: 8, overrideFrozen: false });

    act(() => toggle.click());
    act(() => document.getElementById("train-btn-start-upn_v2")?.click());
    expect(onStart).toHaveBeenLastCalledWith(VISION, { batchSize: 8, overrideFrozen: true });
  });

  it("has no override toggle on an assistant LLM card (QLoRA route)", () => {
    const onStart = render(LLM);
    expect(document.getElementById("train-input-override-frozen-ai_helper_lemgend")).toBeNull();
    act(() => document.getElementById("train-btn-start-ai_helper_lemgend")?.click());
    expect(onStart).toHaveBeenLastCalledWith(LLM, { batchSize: 8, overrideFrozen: false });
  });
});
