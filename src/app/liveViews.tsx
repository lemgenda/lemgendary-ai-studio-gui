/**
 * LemGendary AI Studio - views bound to the shared event buffer.
 *
 * Each one subscribes to `events` itself, so the App shell does not
 * re-render (and re-render every tab) on each telemetry event.
 */

import React, { useMemo } from "react";
import { PipelineEvent } from "../api/types";
import { LogPanel } from "../components/LogPanel";
import { PipelinePanel } from "../components/PipelinePanel";
import { PipelineStepCards } from "../components/PipelineStepCards";
import { useStudioStore } from "../store/useStudioStore";

export interface LiveLogPanelProps {
  /** Show (and clear) only the events this predicate accepts; all events when omitted. */
  filter?: (ev: PipelineEvent) => boolean;
}

export const LiveLogPanel: React.FC<LiveLogPanelProps> = ({ filter }) => {
  const events = useStudioStore((s) => s.events);
  const setEvents = useStudioStore((s) => s.setEvents);
  const clearEvents = useStudioStore((s) => s.clearEvents);
  const wsConnected = useStudioStore((s) => s.wsConnected);
  const shown = useMemo(() => (filter ? events.filter(filter) : events), [events, filter]);
  const onClear = filter ? () => setEvents((prev) => prev.filter((e) => !filter(e))) : clearEvents;
  return <LogPanel events={shown} onClear={onClear} isConnected={wsConnected} />;
};

export interface LivePipelinePanelProps {
  onRunPipeline: (clean: boolean) => void;
}

export const LivePipelinePanel: React.FC<LivePipelinePanelProps> = ({ onRunPipeline }) => {
  const events = useStudioStore((s) => s.events);
  const isRunning = useStudioStore((s) => s.isRunningPipeline);
  const envManagerOnline = useStudioStore((s) => s.meshStatus.envManager);
  return (
    <PipelinePanel
      isRunning={isRunning}
      onRunPipeline={onRunPipeline}
      recentEvents={events}
      envManagerOnline={envManagerOnline}
    />
  );
};

export interface LivePipelineStepCardsProps {
  onRunStep: (stepNumber: number) => Promise<void>;
}

export const LivePipelineStepCards: React.FC<LivePipelineStepCardsProps> = ({ onRunStep }) => {
  const events = useStudioStore((s) => s.events);
  const isRunning = useStudioStore((s) => s.isRunningPipeline);
  const envManagerOnline = useStudioStore((s) => s.meshStatus.envManager);
  const activeStepNum = events.length > 0 && isRunning ? events[events.length - 1].step_number : null;
  return (
    <PipelineStepCards
      isRunning={isRunning}
      activeStepNum={activeStepNum}
      onRunStep={onRunStep}
      recentEvents={events}
      envManagerOnline={envManagerOnline}
    />
  );
};
