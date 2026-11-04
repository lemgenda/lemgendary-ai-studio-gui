/**
 * LemGendary AI Studio - sidecar mesh and telemetry event contracts (all three sidecars).
 */

export interface PipelineEvent {
  timestamp: string;
  step_number: number;
  total_steps: number;
  step_name: string;
  status: "info" | "success" | "warning" | "error";
  message: string;
  is_progress?: boolean;
  data?: Record<string, unknown>;
  origin?: "env-manager" | "training-suite" | "dataset-compiler";
  port?: number;
}

export interface SidecarNodeStatus {
  service: string;
  port: number;
  status: "online" | "offline" | "error";
  reachable: boolean;
  error?: string;
}

export interface EcosystemSidecarMesh {
  env_manager: SidecarNodeStatus;
  dataset_compiler: SidecarNodeStatus;
  training_suite: SidecarNodeStatus;
}

export interface MeshStatus {
  envManager: boolean;
  datasetCompiler: boolean;
  trainingSuite: boolean;
}

export interface ServiceOperationResult {
  status: string;
  message: string;
  port?: number;
  pid?: number;
}
