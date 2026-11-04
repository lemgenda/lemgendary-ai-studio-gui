import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchModels } from "../modelCatalog";

afterEach(() => vi.unstubAllGlobals());

function serve(models: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(models), { status: 200 })));
}

describe("fetchModels training status (TR-2a: required in ModelWithStats)", () => {
  it("shows the sidecar's verdict as sent, never derived from epochs or pillars", async () => {
    serve([
      {
        key: "upn_v2",
        epochs_completed: 40,
        sota_reached: true,
        ladder_passed: true,
        data_fraction_passed: true,
        checkpoint_exists: true,
        is_fully_trained: false,
        training_status: "partially_trained",
      },
    ]);
    const [model] = await fetchModels();
    expect(model.training_status).toBe("partially_trained");
    expect(model.is_fully_trained).toBe(false);
  });

  it("keeps an unknown status and its stats_error", async () => {
    serve([{ key: "upn_v2", epochs_completed: 3, is_fully_trained: false, training_status: "unknown", stats_error: "metrics.csv unreadable" }]);
    const [model] = await fetchModels();
    expect(model.training_status).toBe("unknown");
    expect(model.stats_error).toBe("metrics.csv unreadable");
  });
});
