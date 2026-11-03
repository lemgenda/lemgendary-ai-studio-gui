/**
 * LemGendary AI Studio - the training telemetry console bound to the shared
 * event buffer.
 *
 * Only this component subscribes to `events`, so a telemetry tick re-renders
 * the console and not the training panel and its model cards.
 */

import React from "react";
import { useStudioStore } from "../../store/useStudioStore";
import { TelemetryConsole } from "./TelemetryConsole";
import { TelemetryTab } from "./useModelActions";
import { useTelemetryStream } from "./useTelemetryStream";

export interface TrainingTelemetryProps {
  activeTelemetryTab: TelemetryTab;
  onTabChange: (tab: TelemetryTab) => void;
  onStopLocalTrain: () => void;
  isStoppingLocal: boolean;
  logSlot?: React.ReactNode;
}

export const TrainingTelemetry: React.FC<TrainingTelemetryProps> = ({
  activeTelemetryTab,
  onTabChange,
  onStopLocalTrain,
  isStoppingLocal,
  logSlot,
}) => {
  const events = useStudioStore((s) => s.events);
  const localJob = useStudioStore((s) => s.localJob);
  const remoteJob = useStudioStore((s) => s.remoteJob);

  const local = useTelemetryStream(events, remoteJob.jobId, "local");
  const remote = useTelemetryStream(events, remoteJob.jobId, "remote");

  return (
    <TelemetryConsole
      activeTelemetryTab={activeTelemetryTab}
      onTabChange={onTabChange}
      localJobId={localJob.jobId}
      localJobModel={localJob.modelKey}
      remoteJobId={remoteJob.jobId}
      remoteJobModel={remoteJob.modelKey}
      displayedLocalEvents={local.events}
      displayedRemoteEvents={remote.events}
      onCopyLocalStream={local.copy}
      localCopied={local.copied}
      onClearLocalStream={local.clear}
      onStopLocalTrain={onStopLocalTrain}
      isStoppingLocal={isStoppingLocal}
      onCopyRemoteStream={remote.copy}
      remoteCopied={remote.copied}
      onClearRemoteStream={remote.clear}
      logSlot={logSlot}
    />
  );
};
