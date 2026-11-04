import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { ModelMetricsSection } from "../ModelMetricsSection";
import { ModelItem } from "../../../api/types";

const BASE_MODEL: ModelItem = {
  key: "mirnet_lowlight",
  display_name: "MIRNet Low-Light",
  architecture: "MIRNet",
  task_type: "lowlight",
  training_status: "initializing",
  is_fully_trained: false,
};

const render = (model: ModelItem): string =>
  renderToStaticMarkup(
    <ModelMetricsSection model={model} statusUnknown={false} isTargetPinned={true} onToggleTargetPin={vi.fn()} />
  );

describe("ModelMetricsSection", () => {
  it("shows N/A for null parameters_m", () => {
    expect(render({ ...BASE_MODEL, parameters_m: null, best_metric: null })).toContain("N/A");
  });

  it("shows 0 parameters_m as a value, not N/A", () => {
    const html = render({ ...BASE_MODEL, parameters_m: 0 });
    expect(html).toContain("0 M");
    expect(html).not.toContain("N/A");
  });

  it("shows a dash for a null SOTA target and achieved value", () => {
    const html = render({
      ...BASE_MODEL,
      sota_details: [{ key: "psnr", label: "PSNR", target: null, achieved: null, lower_is_better: false, passed: false }],
    });
    expect(html).toContain("Goal: —");
  });
});
