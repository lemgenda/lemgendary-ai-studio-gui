import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { RecordedClip, RecorderBackend, tauriRecorderBackend } from "./recording";
import { RecorderView, RecordingController } from "./recordingController";

export interface RecorderControls {
  view: RecorderView;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  clearError: () => void;
}

/**
 * React binding for `RecordingController`. `onFinished` receives each
 * finished clip; an unfinished recording is discarded on unmount.
 */
export function useRecorder(
  onFinished: (clip: RecordedClip) => void,
  backend: RecorderBackend = tauriRecorderBackend
): RecorderControls {
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;
  const controller = useMemo(
    () => new RecordingController(backend, (clip) => finishedRef.current(clip)),
    [backend]
  );
  const view = useSyncExternalStore(controller.subscribe, controller.getView);

  useEffect(() => {
    controller.activate();
    return () => {
      void controller.dispose();
    };
  }, [controller]);

  const actions = useMemo(
    () => ({
      start: () => void controller.start(),
      pause: () => void controller.pause(),
      resume: () => void controller.resume(),
      stop: () => void controller.stop(),
      clearError: () => controller.clearError(),
    }),
    [controller]
  );
  return { view, ...actions };
}
