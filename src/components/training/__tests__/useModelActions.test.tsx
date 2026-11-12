// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelActionDeps, useModelActions } from "../useModelActions";
import * as client from "../../../api/client";

vi.mock("../../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../api/client")>();
  return {
    ...actual,
    pushKaggleModelArtifacts: vi.fn(),
    generateModelDocs: vi.fn(),
    launchKaggleTrain: vi.fn(),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocked = vi.mocked(client);

type Actions = ReturnType<typeof useModelActions>;

describe("useModelActions status routing", () => {
  let container: HTMLDivElement;
  let root: Root;
  let actions: Actions | null;
  let deps: ModelActionDeps;

  const Harness = ({ hookDeps }: { hookDeps: ModelActionDeps }) => {
    actions = useModelActions(hookDeps);
    return null;
  };

  const lastCall = (fn: unknown): unknown => {
    const calls = vi.mocked(fn as (m: string | null) => void).mock.calls;
    return calls[calls.length - 1]?.[0];
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    actions = null;
    deps = {
      localJob: { jobId: null, modelKey: null },
      setLocalJob: vi.fn(),
      setRemoteJob: vi.fn(),
      setActiveTelemetryTab: vi.fn(),
      setStatusNotice: vi.fn(),
      setStatusError: vi.fn(),
      loadTrainingData: vi.fn(async () => undefined),
      loadKaggleData: vi.fn(async () => undefined),
      kaggleUsername: undefined,
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<Harness hookDeps={deps} />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("sends a failed action to the error banner and clears the notice", async () => {
    mocked.pushKaggleModelArtifacts.mockRejectedValue(new Error("boom"));
    await act(async () => {
      await actions?.handlePushArtifacts("upn_v2");
    });
    expect(lastCall(deps.setStatusError)).toBe("Failed pushing artifacts for upn_v2: boom");
    expect(lastCall(deps.setStatusNotice)).toBeNull();
  });

  it("sends a successful action to the notice banner and clears an old error", async () => {
    mocked.generateModelDocs.mockResolvedValue({
      status: "success",
      model_key: "upn_v2",
      readme_path: "README.md",
      metadata_path: "model-metadata.json",
    });
    await act(async () => {
      await actions?.handleGenerateDocs("upn_v2");
    });
    expect(deps.setStatusError).toHaveBeenCalledWith(null);
    expect(lastCall(deps.setStatusError)).toBeNull();
    expect(lastCall(deps.setStatusNotice)).toBe("Regenerated README.md and model-metadata.json for upn_v2.");
  });

  it("reports a failed Kaggle dispatch as an error and still rethrows", async () => {
    mocked.launchKaggleTrain.mockRejectedValue(new Error("no quota"));
    let thrown: unknown = null;
    await act(async () => {
      try {
        await actions?.handleLaunchKaggle("upn_v2", "T4", false);
      } catch (err: unknown) {
        thrown = err;
      }
    });
    expect(thrown).toBeInstanceOf(Error);
    expect(lastCall(deps.setStatusError)).toBe("Failed to dispatch Kaggle training: no quota");
  });
});
