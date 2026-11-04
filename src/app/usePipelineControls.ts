/**
 * LemGendary AI Studio - trigger the install pipeline, one step of it, or a
 * single-project reconcile. Completion is detected by `useMeshSync`.
 */

import { MutableRefObject } from "react";
import { triggerPipeline, triggerPipelineStep } from "../api/client";
import { useStudioStore } from "../store/useStudioStore";
import { logger } from "../utils/logger";
import { servicePort } from "../api/config";

export interface PipelineControlDeps {
  runningSingleStepRef: MutableRefObject<number | null>;
  setRefreshError: (message: string | null) => void;
}

export interface PipelineControls {
  handleRunPipeline: (clean: boolean) => Promise<void>;
  handleReconcileProject: (projectName: string) => Promise<void>;
  handleRunPipelineStep: (stepNumber: number) => Promise<void>;
}

export function usePipelineControls({ runningSingleStepRef, setRefreshError }: PipelineControlDeps): PipelineControls {
  const setIsRunningPipeline = useStudioStore((s) => s.setIsRunningPipeline);

  const handleRunPipeline = async (clean: boolean) => {
    try {
      runningSingleStepRef.current = null;
      setIsRunningPipeline(true);
      await triggerPipeline({ clean });
    } catch (err: unknown) {
      logger.error("Pipeline trigger failed", err);
      setRefreshError(`Pipeline trigger failed: Environment Manager (Port ${servicePort("env-manager")}) is not reachable.`);
      setIsRunningPipeline(false);
    }
  };

  const handleReconcileProject = async (projectName: string) => {
    try {
      runningSingleStepRef.current = null;
      setIsRunningPipeline(true);
      await triggerPipeline({ clean: false, targetProject: projectName });
    } catch (err: unknown) {
      logger.error(`Reconcile failed for ${projectName}`, err);
      setRefreshError(`Reconcile failed for ${projectName}: Environment Manager (Port ${servicePort("env-manager")}) is not reachable.`);
      setIsRunningPipeline(false);
    }
  };

  const handleRunPipelineStep = async (stepNumber: number) => {
    try {
      runningSingleStepRef.current = stepNumber;
      setIsRunningPipeline(true);
      await triggerPipelineStep(stepNumber, false);
    } catch (err: unknown) {
      logger.error(`Pipeline step ${stepNumber} trigger failed`, err);
      setRefreshError(`Failed to trigger Step ${stepNumber}: Environment Manager (Port ${servicePort("env-manager")}) is not reachable.`);
      runningSingleStepRef.current = null;
      setIsRunningPipeline(false);
    }
  };

  return { handleRunPipeline, handleReconcileProject, handleRunPipelineStep };
}
