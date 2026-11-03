/**
 * LemGendary AI Studio - project cards shown before the Environment Manager reports health.
 * Derived from the managed projects in the ecosystem snapshot.
 */

import { ProjectHealth } from "../api/types";
import { ECOSYSTEM } from "../api/ecosystem";

export const FALLBACK_PROJECTS: ProjectHealth[] = ECOSYSTEM.projects
  .filter((p) => p.managed)
  .map((p) => ({
    name: p.folder,
    project_dir: `./${p.folder}`,
    venv_exists: false,
    total_required: 0,
    total_installed: 0,
    missing_packages: [],
    installed_packages: {},
    is_healthy: false,
  }));
