/**
 * LemGendary AI Studio - sidecar HTTP base URLs, derived from the mesh SSOT (./config).
 */

import { MESH_SERVICES } from "./config";

export const ENV_BASE = MESH_SERVICES["env-manager"].httpUrl;
export const DATASETS_BASE = MESH_SERVICES["dataset-compiler"].httpUrl;
export const TRAINING_BASE = MESH_SERVICES["training-suite"].httpUrl;
