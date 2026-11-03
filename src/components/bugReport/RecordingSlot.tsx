import React from "react";
import { RecordedClip, formatClock, formatFileSize } from "../../bugReport/recording";

interface RecordingSlotProps {
  /** True inside the desktop app, where the native app-window recorder exists. */
  available: boolean;
  recording: RecordedClip | null;
  /** Hides the dialog and starts recording the app window. */
  onStart: () => void;
  onRemove: () => void;
  /** Recorder failure (start, capture or encoding). */
  recorderError: string | null;
  /** Validation or server error for the `recording` field. */
  error?: string;
}

/**
 * Screen recording attachment: starts a recording of the app window (up to
 * 60 s, MP4) and shows the attached clip, which is sent as the `recording` part.
 */
export const RecordingSlot: React.FC<RecordingSlotProps> = ({
  available,
  recording,
  onStart,
  onRemove,
  recorderError,
  error,
}) => (
  <fieldset id="bug-modal-recording-slot" className="bug-attachment-group" disabled={!available}>
    <legend>Recording</legend>
    {!available && <p className="field-hint">Screen recording is available in the desktop app.</p>}
    {available && !recording && (
      <>
        <p className="field-hint">
          Records only this app window, up to 60 seconds. The dialog hides while you reproduce the problem.
        </p>
        <button id="bug-modal-btn-start-recording" type="button" className="btn btn-secondary btn-sm" onClick={onStart}>
          Start recording
        </button>
      </>
    )}
    {available && recording && (
      <>
        <p id="bug-modal-recording-summary" className="field-hint">
          Recording attached: {formatClock(recording.durationMs)}, {recording.width}x{recording.height},{" "}
          {formatFileSize(recording.blob.size)} (MP4)
        </p>
        <button id="bug-modal-btn-remove-recording" type="button" className="btn btn-secondary btn-sm" onClick={onRemove}>
          Remove recording
        </button>
      </>
    )}
    {recorderError && (
      <p id="bug-modal-recorder-error" className="field-error" role="alert">
        {recorderError}
      </p>
    )}
    {error && (
      <p id="bug-modal-recording-error" className="field-error" role="alert">
        {error}
      </p>
    )}
  </fieldset>
);

export default RecordingSlot;
