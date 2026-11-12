import { describe, it, expect } from "vitest";
import snapshot from "../../generated/ecosystem.json";
import { ECOSYSTEM, ecosystemProject, ecosystemService } from "../ecosystem";
import { MESH_SERVICES, SERVICE_IDS } from "../config";
import { CANONICAL_PROJECT_NAMES, getProjectDisplayName } from "../contracts/envManager";
import { FALLBACK_PROJECTS } from "../../app/fallbackProjects";
import { PIPELINE_STEPS } from "../../components/PipelineStepCards";

/** The sibling SSOT file; the glob is empty when the Environment Manager repo is not checked out. */
const siblingSources = Object.values(
  import.meta.glob<string>("../../../../lemgendary-env-manager/ecosystem/ecosystem.json", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
);

describe("ecosystem snapshot", () => {
  it("has the schema-v1 shape", () => {
    expect(snapshot.schema_version).toBe(1);
    expect(Object.keys(snapshot.identity).sort()).toEqual(["bind_host", "docs_url", "github_url", "kaggle_owner"]);
    for (const service of snapshot.services) {
      expect(Object.keys(service).sort()).toEqual([
        "aliases", "app_import", "health_path", "id", "liveness_path", "log_dir", "port", "project", "websocket_path",
      ]);
    }
    for (const project of snapshot.projects) {
      expect(Object.keys(project).sort()).toEqual([
        "display_name", "folder", "git_hooked", "kind", "legacy_folders", "managed",
        "npm_manifest", "requirements_manifest", "upgrade_order", "validated",
      ]);
    }
    expect(snapshot.pipeline_steps.map((s) => s.number)).toEqual(snapshot.pipeline_steps.map((_, i) => i + 1));
    expect(Object.keys(snapshot.kaggle).sort()).toEqual([
      "accelerators", "collaborators", "default_accelerator", "retired_machine_shapes",
    ]);
    const acceleratorIds = snapshot.kaggle.accelerators.map((a) => a.id);
    expect(acceleratorIds).toContain(snapshot.kaggle.default_accelerator);
  });

  it("every service points at a known project", () => {
    for (const service of ECOSYSTEM.services) {
      expect(ecosystemProject(service.project).folder).toBe(service.project);
    }
  });

  it.skipIf(siblingSources.length === 0)("matches the sibling Environment Manager source", () => {
    expect(siblingSources).toHaveLength(1);
    expect(JSON.parse(siblingSources[0])).toEqual(snapshot);
  });

  it("fails loudly for unknown ids", () => {
    expect(() => ecosystemService("nope")).toThrow(/missing from src\/generated\/ecosystem.json/);
    expect(() => ecosystemProject("nope")).toThrow(/missing from src\/generated\/ecosystem.json/);
  });
});

describe("values derived from the ecosystem snapshot", () => {
  it("MESH_SERVICES takes ports, paths and names from services[]", () => {
    expect(SERVICE_IDS).toEqual(ECOSYSTEM.services.map((s) => s.id));
    for (const service of ECOSYSTEM.services) {
      const mesh = MESH_SERVICES[service.id as keyof typeof MESH_SERVICES];
      expect(mesh.defaultPort).toBe(service.port);
      expect(mesh.livenessPath).toBe(service.liveness_path);
      expect(mesh.name).toBe(ecosystemProject(service.project).display_name);
      expect(mesh.httpUrl).toBe(`http://${ECOSYSTEM.identity.bind_host}:${service.port}`);
      expect(mesh.wsUrl).toBe(`ws://${ECOSYSTEM.identity.bind_host}:${service.port}${service.websocket_path}`);
    }
  });

  it("CANONICAL_PROJECT_NAMES maps every project folder to its display name", () => {
    expect(Object.keys(CANONICAL_PROJECT_NAMES)).toEqual(ECOSYSTEM.projects.map((p) => p.folder));
    expect(getProjectDisplayName("lemgendary-ai-studio-gui")).toBe("LemGendary AI Studio GUI");
    expect(getProjectDisplayName("unknown-folder")).toBe("unknown-folder");
  });

  it("FALLBACK_PROJECTS lists the managed projects only", () => {
    expect(FALLBACK_PROJECTS.map((p) => p.name)).toEqual(
      ECOSYSTEM.projects.filter((p) => p.managed).map((p) => p.folder),
    );
    expect(FALLBACK_PROJECTS.every((p) => p.project_dir === `./${p.name}` && !p.is_healthy)).toBe(true);
  });

  it("PIPELINE_STEPS uses the file's step names and descriptions", () => {
    expect(PIPELINE_STEPS).toEqual(
      ECOSYSTEM.pipeline_steps.map((s) => ({
        num: s.number,
        name: s.name,
        shortDesc: s.short_description,
        detailedDesc: s.long_description,
      })),
    );
    expect(PIPELINE_STEPS[3].name).toBe("Requirements Sync & Install");
  });
});
