import React from "react";

interface RecordingSlotProps {
  /** True once the native app-window recorder is available (desktop app). */
  available: boolean;
  recording: Blob | null;
  onRecordingChange: (recording: Blob | null) => void;
  error?: string;
}

/**
 * Screen recording attachment. Until the native recorder exists this shows a
 * disabled placeholder; the recorder plugs in here and reports its clip
 * through `onRecordingChange`, which the modal sends as the `recording` part.
 */
export const RecordingSlot: React.FC<RecordingSlotProps> = ({ available, recording, onRecordingChange, error }) => (
  <fieldset id="bug-modal-recording-slot" className="bug-attachment-group" disabled={!available}>
    <legend>Recording</legend>
    {!available && <p className="field-hint">Screen recording is available in the desktop app.</p>}
    {available && recording && (
      <button
        id="bug-modal-btn-remove-recording"
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onRecordingChange(null)}
      >
        Remove recording
      </button>
    )}
    {error && (
      <p id="bug-modal-recording-error" className="field-error" role="alert">
        {error}
      </p>
    )}
  </fieldset>
);

export default RecordingSlot;
