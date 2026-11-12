// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ModelCardActions } from "../ModelCardActions";
import { ModelItem } from "../../../api/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MODEL: ModelItem = {
  key: "upn_v2",
  display_name: "UPN v2",
  architecture: "MobileNetV3",
  task_type: "enhance",
  is_fully_trained: false,
  training_status: "weights_ready",
};

const noop = (): void => undefined;

describe("ModelCardActions sidecar guard", () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = (online: boolean) =>
    act(() =>
      root.render(
        <ModelCardActions
          model={MODEL}
          isCurrentlyTrainingThis={false}
          isBusy={false}
          actionBusyKey={null}
          generatingNotebookModel={null}
          trainingSuiteOnline={online}
          selectedBatchSize={8}
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
          onBlendSoup={noop}
        />
      )
    );

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("disables every model action while the Training Suite is offline", () => {
    render(false);
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons).toHaveLength(11);
    for (const button of buttons) {
      expect(button.disabled).toBe(true);
    }
  });

  it("enables the actions when the Training Suite is online", () => {
    render(true);
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.every((b) => !b.disabled)).toBe(true);
  });
});
