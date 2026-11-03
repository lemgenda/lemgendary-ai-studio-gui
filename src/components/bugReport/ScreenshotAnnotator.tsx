import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "../common/Modal";
import { CAPTURE_EXCLUDE_PROPS, ScreenCapturer, encodeScreenshot } from "../../bugReport/screenshotCapture";

/** Highlight rectangle in screenshot pixels. */
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const STROKE_COLOR = "#ff0000";
const FILL_COLOR = "rgba(255, 0, 0, 0.2)";

/** Draw the screenshot and, if set, the single highlight rectangle. */
function paint(target: HTMLCanvasElement, source: HTMLCanvasElement, rect: Rect | null): void {
  const context = target.getContext("2d");
  if (!context) return;
  target.width = source.width;
  target.height = source.height;
  context.drawImage(source, 0, 0);
  if (!rect || rect.width === 0 || rect.height === 0) return;
  context.fillStyle = FILL_COLOR;
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  context.strokeStyle = STROKE_COLOR;
  context.lineWidth = Math.max(2, Math.round(source.width / 400));
  context.strokeRect(rect.x, rect.y, rect.width, rect.height);
}

function normalise(start: { x: number; y: number }, end: { x: number; y: number }): Rect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

type AnnotatorStatus = "capturing" | "ready" | "saving" | "error";

interface ScreenshotAnnotatorProps {
  isOpen: boolean;
  capture: ScreenCapturer;
  onSave: (screenshot: Blob) => void;
  onCancel: () => void;
}

/**
 * Captures the app (without itself or the bug report form), lets the user
 * drag one red highlight rectangle (a new drag replaces it), and saves the
 * result as WebP (PNG where the WebView cannot encode WebP).
 */
export const ScreenshotAnnotator: React.FC<ScreenshotAnnotatorProps> = ({ isOpen, capture, onSave, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [status, setStatus] = useState<AnnotatorStatus>("capturing");
  const [error, setError] = useState<string | null>(null);
  const captureRunRef = useRef(0);

  const takeScreenshot = useCallback(async () => {
    const run = captureRunRef.current + 1;
    captureRunRef.current = run;
    setStatus("capturing");
    setError(null);
    setRect(null);
    try {
      const canvas = await capture();
      if (captureRunRef.current !== run) return;
      sourceRef.current = canvas;
      setStatus("ready");
    } catch (err: unknown) {
      if (captureRunRef.current !== run) return;
      console.error("Screenshot capture failed:", err);
      setError(`The screenshot could not be captured: ${err instanceof Error ? err.message : String(err)}`);
      setStatus("error");
    }
  }, [capture]);

  useEffect(() => {
    if (!isOpen) return;
    void takeScreenshot();
    return () => {
      captureRunRef.current += 1;
      sourceRef.current = null;
    };
  }, [isOpen, takeScreenshot]);

  useEffect(() => {
    if (status === "capturing" || !canvasRef.current || !sourceRef.current) return;
    paint(canvasRef.current, sourceRef.current, rect);
  }, [rect, status]);

  const toImagePoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    const scaleX = bounds.width > 0 ? canvas.width / bounds.width : 1;
    const scaleY = bounds.height > 0 ? canvas.height / bounds.height : 1;
    return {
      x: Math.min(canvas.width, Math.max(0, (event.clientX - bounds.left) * scaleX)),
      y: Math.min(canvas.height, Math.max(0, (event.clientY - bounds.top) * scaleY)),
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== "ready") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toImagePoint(event);
    dragStartRef.current = point;
    setRect(normalise(point, point));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragStartRef.current) return;
    setRect(normalise(dragStartRef.current, toImagePoint(event)));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragStartRef.current) return;
    setRect(normalise(dragStartRef.current, toImagePoint(event)));
    dragStartRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleSave = async () => {
    const source = sourceRef.current;
    if (!source) return;
    setStatus("saving");
    try {
      const output = document.createElement("canvas");
      paint(output, source, rect);
      onSave(await encodeScreenshot(output));
    } catch (err: unknown) {
      console.error("Screenshot encoding failed:", err);
      setError(`The screenshot could not be saved: ${err instanceof Error ? err.message : String(err)}`);
      setStatus("error");
    }
  };

  const statusText =
    status === "capturing"
      ? "Capturing the app window..."
      : status === "saving"
        ? "Saving the screenshot..."
        : "Drag over the screenshot to highlight the problem area. A new drag replaces the highlight.";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      id="annotator-dialog"
      title="Annotate screenshot"
      className="modal-content-annotator"
      describedById="annotator-status"
      backdropAttributes={CAPTURE_EXCLUDE_PROPS}
      footer={
        <>
          <button id="annotator-btn-cancel" type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            id="annotator-btn-retake"
            type="button"
            className="btn btn-secondary"
            onClick={() => void takeScreenshot()}
            disabled={status === "capturing" || status === "saving"}
          >
            Retake
          </button>
          <button
            id="annotator-btn-save"
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSave()}
            disabled={status !== "ready"}
          >
            Save
          </button>
        </>
      }
    >
      <p id="annotator-status" className="field-hint" role="status">
        {statusText}
      </p>
      {error && (
        <p id="annotator-error" className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="annotator-stage">
        {status !== "capturing" && status !== "error" && (
          <canvas
            id="annotator-canvas"
            ref={canvasRef}
            className="annotator-canvas"
            aria-label="Screenshot of the app. Drag to draw a highlight rectangle."
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        )}
      </div>
    </Modal>
  );
};

export default ScreenshotAnnotator;
