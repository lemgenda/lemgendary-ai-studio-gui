import { domToCanvas } from "modern-screenshot";
import { BUG_REPORT_LIMITS } from "./limits";

/**
 * Elements carrying this attribute (and their children) are left out of the
 * screenshot: the bug report modal and the annotator overlay.
 */
export const CAPTURE_EXCLUDE_ATTRIBUTE = "data-capture-exclude";
export const CAPTURE_EXCLUDE_PROPS: Record<string, string> = { [CAPTURE_EXCLUDE_ATTRIBUTE]: "true" };

/** Renders the app into a canvas. Injected into the UI so tests can replace it. */
export type ScreenCapturer = () => Promise<HTMLCanvasElement>;

const SCREENSHOT_QUALITY = 0.92;
const MAX_CAPTURE_SCALE = 2;

function isIncluded(node: Node): boolean {
  return !(node instanceof Element && node.hasAttribute(CAPTURE_EXCLUDE_ATTRIBUTE));
}

/**
 * Capture the app DOM with `modern-screenshot`, which serialises the page
 * into an SVG `foreignObject` that the browser itself renders, so every CSS
 * feature the WebView supports is drawn as on screen.
 */
export const captureAppScreen: ScreenCapturer = async () => {
  const root = document.getElementById("root") ?? document.body;
  const scale = Math.min(window.devicePixelRatio || 1, MAX_CAPTURE_SCALE);
  const background = getComputedStyle(document.body).backgroundColor;
  return domToCanvas(root, {
    filter: isIncluded,
    scale,
    backgroundColor: background,
  });
};

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Encode a canvas as WebP (quality 0.92). WebKit returns null or a PNG for
 * WebP, so PNG is used then. Both are accepted by the server.
 */
export async function canvasToImageBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await toBlob(canvas, "image/webp", SCREENSHOT_QUALITY);
  if (webp && webp.type === "image/webp") return webp;
  const png = await toBlob(canvas, "image/png");
  if (png) return png;
  throw new Error("The browser could not encode the screenshot as WebP or PNG.");
}

function scaledCopy(canvas: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const copy = document.createElement("canvas");
  copy.width = Math.max(1, Math.round(canvas.width * factor));
  copy.height = Math.max(1, Math.round(canvas.height * factor));
  const context = copy.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable.");
  context.drawImage(canvas, 0, 0, copy.width, copy.height);
  return copy;
}

/**
 * Encode a screenshot, halving its size (at most three times) until it fits
 * the server's per-screenshot limit.
 */
export async function encodeScreenshot(canvas: HTMLCanvasElement): Promise<Blob> {
  let current = canvas;
  for (let attempt = 0; ; attempt += 1) {
    const blob = await canvasToImageBlob(current);
    if (blob.size <= BUG_REPORT_LIMITS.screenshotMaxBytes || attempt >= 3) return blob;
    current = scaledCopy(current, 0.5);
  }
}
