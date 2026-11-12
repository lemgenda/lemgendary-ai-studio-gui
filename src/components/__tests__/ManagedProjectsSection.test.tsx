// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManagedProjectsSection } from "../ManagedProjectsSection";
import { useStudioStore } from "../../store/useStudioStore";
import { HealthAuditReport, ProjectHealth } from "../../api/types";
import * as client from "../../api/client";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return { ...actual, fetchProjects: vi.fn() };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocked = vi.mocked(client);

function project(name: string, healthy: boolean): ProjectHealth {
  return {
    name,
    project_dir: `./${name}`,
    venv_exists: healthy,
    python_version: healthy ? "3.12.4" : null,
    total_required: 2,
    total_installed: healthy ? 2 : 0,
    missing_packages: healthy ? [] : ["a", "b"],
    installed_packages: {},
    is_healthy: healthy,
  };
}

describe("ManagedProjectsSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = async (envManagerOnline: boolean) => {
    const health = useStudioStore.getState().health;
    await act(async () => {
      root.render(
        <ManagedProjectsSection
          projects={health?.projects ?? []}
          onInstall={vi.fn()}
          isProcessing={false}
          isOffline={!health}
          envManagerOnline={envManagerOnline}
        />
      );
    });
  };

  beforeEach(() => {
    useStudioStore.setState({ health: { projects: [project("lemgendary-datasets", false)] } as unknown as HealthAuditReport });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useStudioStore.setState({ health: null });
    vi.clearAllMocks();
  });

  it("disables the refresh while the Environment Manager is offline", async () => {
    await render(false);
    expect((document.getElementById("dash-btn-refresh-projects") as HTMLButtonElement).disabled).toBe(true);
  });

  it("replaces the project rows of the health report with the fresh ones", async () => {
    mocked.fetchProjects.mockResolvedValue([project("lemgendary-datasets", true)]);
    await render(true);
    await act(async () => {
      (document.getElementById("dash-btn-refresh-projects") as HTMLButtonElement).click();
    });
    expect(mocked.fetchProjects).toHaveBeenCalledTimes(1);
    expect(useStudioStore.getState().health?.projects[0].is_healthy).toBe(true);
  });

  it("shows a failed refresh as an error and keeps the report", async () => {
    mocked.fetchProjects.mockRejectedValue(new Error("Failed to fetch projects: Bad Gateway"));
    await render(true);
    await act(async () => {
      (document.getElementById("dash-btn-refresh-projects") as HTMLButtonElement).click();
    });
    expect(container.textContent).toContain("Project health refresh failed: Failed to fetch projects: Bad Gateway");
    expect(useStudioStore.getState().health?.projects[0].is_healthy).toBe(false);
  });
});
