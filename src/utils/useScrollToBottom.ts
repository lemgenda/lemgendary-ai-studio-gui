/**
 * LemGendary AI Studio - keep a log container scrolled to its newest line.
 */

import { RefObject, useEffect } from "react";

/**
 * Scroll `ref` to the bottom whenever `content` changes or `visible` turns
 * true (a console tab re-mounts its container when it is shown again).
 */
export function useScrollToBottom(ref: RefObject<HTMLElement | null>, content: unknown, visible = true): void {
  useEffect(() => {
    const el = ref.current;
    if (visible && el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [ref, content, visible]);
}
