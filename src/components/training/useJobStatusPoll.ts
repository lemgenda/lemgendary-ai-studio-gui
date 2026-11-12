/**
 * LemGendary AI Studio - poll one training-sidecar job until it reaches a
 * terminal state (completed, failed or cancelled), then report it once.
 *
 * Used for the local job and the remote (Kaggle) job of the training panel.
 */

import { useEffect, useRef } from "react";
import { fetchTrainingJob, TERMINAL_JOB_STATUSES } from "../../api/client";
import { TrainingJobInfo } from "../../api/types";
import { logger } from "../../utils/logger";

/** Interval for polling an active job's status on the training sidecar. */
export const JOB_STATUS_POLL_MS = 3000;

/**
 * Poll `GET /api/jobs/{jobId}` every `JOB_STATUS_POLL_MS` while `jobId` is set.
 * `onTerminal` runs once with the final job record; the latest callback is
 * used, so callers do not need to memoise it.
 */
export function useJobStatusPoll(jobId: string | null, onTerminal: (jobId: string, job: TrainingJobInfo) => void): void {
  const onTerminalRef = useRef(onTerminal);
  useEffect(() => {
    onTerminalRef.current = onTerminal;
  }, [onTerminal]);

  useEffect(() => {
    if (!jobId) return;
    let isCancelled = false;

    const pollJobStatus = async () => {
      try {
        const job = await fetchTrainingJob(jobId);
        if (isCancelled || !TERMINAL_JOB_STATUSES.has(job.status)) return;
        isCancelled = true;
        onTerminalRef.current(jobId, job);
      } catch (err: unknown) {
        logger.debug(`Polling status of training job ${jobId} failed; retrying`, err);
      }
    };

    const interval = setInterval(pollJobStatus, JOB_STATUS_POLL_MS);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [jobId]);
}
