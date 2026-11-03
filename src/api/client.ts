/**
 * LemGendary AI Studio - Tripartite Multi-Sidecar API Client.
 *
 * Thin barrel over the per-service modules in this folder, so components keep
 * importing `../api/client` (and tests can mock one module).
 */

export * from "./endpoints";
export * from "./envManager";
export * from "./serviceLifecycle";
export * from "./manifests";
export * from "./secrets";
export * from "./platform";
export * from "./datasets";
export * from "./datasetKaggle";
export * from "./modelCatalog";
export * from "./training";
export * from "./trainingKaggle";
export * from "./modelArtifacts";
export * from "./unitTests";
export * from "./telemetry";
export * from "./eventRouting";
export * from "./socketMessages";
export * from "./logSocket";

export { MESH_SERVICES, SERVICE_IDS } from "./config";
export type { ServiceId } from "./config";
export { sidecarErrorDetail } from "./request";

export type {
  KaggleKernelItem,
  KaggleMonitorPayload,
  KaggleSuiteStatus,
  KaggleTrainPayload,
  MeshStatus,
  ServiceOperationResult,
  TrainingJobInfo,
  DeepCleanResponse,
  HooksInstallResponse,
  ManifoldReducePayload,
  ModelEvalPayload,
  ModelExportPayload,
  ModernizationQueueItem,
  ModernizeRunPayload,
  RegenerateManifoldsResponse,
  UnitTestAllPayload,
  UnitTestSuitePayload,
  UnitTestSuiteResult,
  ModelVariationInfo,
  ModelDocGenResponse,
  ModelStageResponse,
  VariationValidationDetail,
  ModelValidateIsolationResponse,
  KagglePushModelPayload,
  KagglePushModelResponse,
  KagglePushAllPayload,
  KagglePushAllResponse,
  LLMTrainingConfig,
  LLMTrainResponse,
} from "./types";
