import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchModels } from "../modelCatalog";

afterEach(() => vi.unstubAllGlobals());

function serve(models: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(models), { status: 200 })));
}

describe("fetchModels training status fallback (D39)", () => {
  it("uses the governance criteria, not an epoch count, when the sidecar omits is_fully_trained", async () => {
    serve([
      {
        key: "upn_v2",
        epochs_completed: 5,
        sota_reached: true,
        ladder_passed: true,
        data_fraction_passed: true,
        checkpoint_exists: true,
      },
    ]);
    const [model] = await fetchModels();
    expect(model.training_status).toBe("fully_trained");
  });

  it("keeps the sidecar's own verdict", async () => {
    serve([{ key: "upn_v2", epochs_completed: 40, is_fully_trained: false, sota_reached: true, ladder_passed: true, data_fraction_passed: true }]);
    const [model] = await fetchModels();
    expect(model.training_status).toBe("partially_trained");
  });
});
