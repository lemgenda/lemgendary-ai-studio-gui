/**
 * Typed view of the ecosystem SSOT snapshot.
 *
 * `src/generated/ecosystem.json` is copied from
 * `lemgendary-env-manager/ecosystem/ecosystem.json` by `scripts/sync-ecosystem.mjs`
 * (run on `predev`/`prebuild`). Ports, service ids, project names and pipeline
 * steps are derived from it instead of being hardcoded in the GUI.
 */

import snapshot from "../generated/ecosystem.json";

export interface EcosystemIdentity {
  docs_url: string;
  kaggle_owner: string;
  bind_host: string;
}

export interface EcosystemService {
  id: string;
  aliases: string[];
  project: string;
  port: number;
  health_path: string;
  liveness_path: string;
  websocket_path: string;
  app_import: string;
  log_dir: string;
}

export interface EcosystemProject {
  folder: string;
  display_name: string;
  kind: string;
  managed: boolean;
  validated: boolean;
  upgrade_order: number | null;
  git_hooked: boolean;
  requirements_manifest: string | null;
  npm_manifest: string | null;
  legacy_folders: string[];
}

export interface EcosystemPipelineStep {
  number: number;
  id: string;
  name: string;
  short_description: string;
  long_description: string;
}

export interface Ecosystem {
  schema_version: number;
  identity: EcosystemIdentity;
  services: EcosystemService[];
  projects: EcosystemProject[];
  pipeline_steps: EcosystemPipelineStep[];
}

export const ECOSYSTEM: Ecosystem = snapshot;

/** Returns the service entry with this id, failing loudly when the snapshot lacks it. */
export function ecosystemService(id: string): EcosystemService {
  const service = ECOSYSTEM.services.find((s) => s.id === id);
  if (!service) {
    throw new Error(`Service "${id}" is missing from src/generated/ecosystem.json; run "npm run sync:ecosystem".`);
  }
  return service;
}

/** Returns the project entry for this folder, failing loudly when the snapshot lacks it. */
export function ecosystemProject(folder: string): EcosystemProject {
  const project = ECOSYSTEM.projects.find((p) => p.folder === folder);
  if (!project) {
    throw new Error(`Project "${folder}" is missing from src/generated/ecosystem.json; run "npm run sync:ecosystem".`);
  }
  return project;
}

/** Folder of the desktop GUI project: the snapshot's single `kind: node` project. */
export function guiProjectFolder(): string {
  const nodeProjects = ECOSYSTEM.projects.filter((p) => p.kind === "node");
  if (nodeProjects.length !== 1) {
    throw new Error(`Expected one "node" project in src/generated/ecosystem.json, found ${nodeProjects.length}.`);
  }
  return nodeProjects[0].folder;
}
