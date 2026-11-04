/**
 * LemGendary AI Studio - one training telemetry stream (local or remote):
 * the events routed to it, plus copy-to-clipboard and clear controls.
 */

import { useMemo, useState } from "react";
import { isLocalTrainingEvent, isRemoteTrainingEvent } from "../../api/client";
import { PipelineEvent } from "../../api/types";
import { copyTextToClipboard } from "../../utils/clipboard";
import { useTransientValue } from "../../utils/useTransientValue";

export type TrainingStreamKind = "local" | "remote";

export interface TelemetryStream {
  events: PipelineEvent[];
  /** True for 2 s after a successful copy. */
  copied: boolean;
  copy: () => Promise<void>;
  /** Hide events received so far (newer events still show). */
  clear: () => void;
}

export function useTelemetryStream(
  recentEvents: PipelineEvent[] | undefined,
  remoteJobId: string | null,
  kind: TrainingStreamKind
): TelemetryStream {
  const [copied, flashCopied] = useTransientValue<true>(2000);
  const [clearedTimestamp, setClearedTimestamp] = useState<number>(0);

  const events = useMemo(() => {
    const belongs = kind === "local" ? isLocalTrainingEvent : isRemoteTrainingEvent;
    return (recentEvents || [])
      .filter((ev) => belongs(ev, remoteJobId))
      .filter((ev) => !ev.timestamp || new Date(ev.timestamp).getTime() > clearedTimestamp);
  }, [recentEvents, clearedTimestamp, remoteJobId, kind]);

  const copy = async () => {
    if (events.length === 0) return;
    const text = events
      .map((e) => {
        const timeStr = e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : "--:--:--";
        return `[${timeStr}] [${e.step_name}] ${e.message}`;
      })
      .join("\n");

    const copiedOk = await copyTextToClipboard(text);
    if (copiedOk) flashCopied(true);
  };

  const clear = () => {
    setClearedTimestamp(Date.now());
  };

  return { events, copied: copied === true, copy, clear };
}
