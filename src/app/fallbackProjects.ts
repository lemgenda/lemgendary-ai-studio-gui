/**
 * LemGendary AI Studio - project cards shown before the Environment Manager reports health.
 */

import { ProjectHealth } from "../api/types";

export const FALLBACK_PROJECTS: ProjectHealth[] = [
  { name: "lemgendary-env-manager", project_dir: "./lemgendary-env-manager", venv_exists: false, total_required: 0, total_installed: 0, missing_packages: [], installed_packages: {}, is_healthy: false },
  { name: "lemgendary-datasets", project_dir: "./lemgendary-datasets", venv_exists: false, total_required: 0, total_installed: 0, missing_packages: [], installed_packages: {}, is_healthy: false },
  { name: "lemgendary-training-suite", project_dir: "./lemgendary-training-suite", venv_exists: false, total_required: 0, total_installed: 0, missing_packages: [], installed_packages: {}, is_healthy: false },
  { name: "lemgendary-ai-studio-gui", project_dir: "./lemgendary-ai-studio-gui", venv_exists: false, total_required: 0, total_installed: 0, missing_packages: [], installed_packages: {}, is_healthy: false },
  { name: "lemgendary-docs", project_dir: "./lemgendary-docs", venv_exists: false, total_required: 0, total_installed: 0, missing_packages: [], installed_packages: {}, is_healthy: false },
];
