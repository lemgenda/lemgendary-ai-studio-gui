import React from "react";
import { formatClock } from "../../bugReport/recording";
import { RecorderView } from "../../bugReport/recordingController";

interface RecordingControlBarProps {
  view: RecorderView;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

const PHASE_LABEL: Record<RecorderView["phase"], string> = {
  idle: "Recording finished",
  starting: "Starting recording...",
  recording: "Recording",
  paused: "Paused",
  stopping: "Finishing recording...",
};

/**
 * Floating controls shown while the app window is recorded and the Report
 * Issue dialog is hidden. Stopping returns to the dialog with the clip attached.
 */
export const RecordingControlBar: React.FC<RecordingControlBarProps> = ({ view, onPause, onResume, onStop }) => {
  const busy = view.phase === "starting" || view.phase === "stopping";
  return (
    <div id="recording-control-bar" className="recording-control-bar" role="region" aria-label="Screen recording">
      <span className={view.phase === "recording" ? "recording-dot recording-dot-live" : "recording-dot"} aria-hidden="true" />
      <span id="recording-control-status" className="recording-control-status" aria-live="polite">
        {PHASE_LABEL[view.phase]}
      </span>
      <span id="recording-control-time" className="recording-control-time">
        {formatClock(view.elapsedMs)} / {formatClock(view.maxMs)}
      </span>
      {view.phase === "paused" ? (
        <button id="recording-btn-resume" type="button" className="btn btn-secondary btn-sm" onClick={onResume}>
          Continue
        </button>
      ) : (
        <button
          id="recording-btn-pause"
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onPause}
          disabled={view.phase !== "recording"}
        >
          Pause
        </button>
      )}
      <button id="recording-btn-stop" type="button" className="btn btn-primary btn-sm" onClick={onStop} disabled={busy}>
        Stop and attach
      </button>
    </div>
  );
};

export default RecordingControlBar;
