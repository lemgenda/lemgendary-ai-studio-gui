import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface UseMasonryFlipOptions {
  columnCount?: number;
  gap?: number;
  /**
   * Interval in milliseconds between each card disappearing.
   * Defaults to 500ms as requested.
   */
  staggerDisappearMs?: number;
  /**
   * Delay in milliseconds after disappearing before appearing at destination.
   * Defaults to 500ms as requested.
   */
  staggerAppearDelayMs?: number;
  /**
   * Fade transition duration for vanishing/appearing.
   * Kept crisp and instantaneous (120ms) so there are no slow sliding animations.
   */
  fadeDurationMs?: number;
  enableStagger?: boolean;
}

export interface UseMasonryFlipReturn<T> {
  containerRef: React.RefObject<HTMLDivElement | null>;
  columnItems: T[][];
  registerItemRef: (id: string | number, el: HTMLElement | null) => void;
  activeColumnCount: number;
}

interface RectSnapshot {
  left: number;
  top: number;
  width: number;
  height: number;
}

const DEFAULT_STAGGER_DISAPPEAR_MS = 500;
const DEFAULT_STAGGER_APPEAR_DELAY_MS = 500;
const DEFAULT_FADE_DURATION_MS = 120;
const DEFAULT_GAP = 20;

export function useMasonryFlip<T extends { id: string | number }>(
  items: T[],
  options: UseMasonryFlipOptions = {}
): UseMasonryFlipReturn<T> {
  const {
    columnCount: requestedColumnCount,
    gap = DEFAULT_GAP,
    staggerDisappearMs = DEFAULT_STAGGER_DISAPPEAR_MS,
    staggerAppearDelayMs = DEFAULT_STAGGER_APPEAR_DELAY_MS,
    fadeDurationMs = DEFAULT_FADE_DURATION_MS,
    enableStagger = true,
  } = options;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemElementsRef = useRef<Map<string | number, HTMLElement>>(new Map());
  const itemHeightsRef = useRef<Map<string | number, number>>(new Map());
  const prevRectsRef = useRef<Map<string | number, RectSnapshot>>(new Map());
  const activeTimersRef = useRef<Map<string | number, number[]>>(new Map());
  const isInitialMountRef = useRef<boolean>(true);
  const prevItemsRef = useRef<Set<string | number>>(new Set());

  // Dynamic responsive columns calculation based on container width if columnCount is not fixed
  const [measuredColumnCount, setMeasuredColumnCount] = useState<number>(3);

  const determineColumns = useCallback(
    (width: number): number => {
      if (requestedColumnCount && requestedColumnCount > 0) {
        return requestedColumnCount;
      }
      if (width <= 720) {
        return 1;
      }
      if (width <= 1180) {
        return 2;
      }
      if (width <= 1640) {
        return 3;
      }
      return 4;
    },
    [requestedColumnCount]
  );

  // Observe container width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateColumns = () => {
      const width = container.getBoundingClientRect().width;
      const cols = determineColumns(width);
      setMeasuredColumnCount((prev) => (prev !== cols ? cols : prev));
    };

    updateColumns();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentBoxSize) {
          const width = entry.contentRect.width;
          const cols = determineColumns(width);
          setMeasuredColumnCount((prev) => (prev !== cols ? cols : prev));
        }
      }
    });

    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
    };
  }, [determineColumns]);

  const activeColumnCount = Math.max(1, measuredColumnCount);

  // Measure card heights with ResizeObserver and trigger distribution update
  const [, setHeightVersion] = useState<number>(0);

  const registerItemRef = useCallback(
    (id: string | number, el: HTMLElement | null) => {
      if (!el) {
        itemElementsRef.current.delete(id);
        itemHeightsRef.current.delete(id);
        return;
      }

      itemElementsRef.current.set(id, el);
      const measuredH = el.offsetHeight;
      if (measuredH > 0) {
        itemHeightsRef.current.set(id, measuredH);
      }
    },
    []
  );

  // Card resize observer to update heights dynamically without infinite loops
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    let frameId: number | null = null;
    const dirtyIds = new Set<string | number>();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        const id = target.dataset.masonryId;
        if (!id) continue;

        const newHeight = Math.round(entry.contentRect.height);
        const oldHeight = itemHeightsRef.current.get(id);

        if (oldHeight === undefined || Math.abs(oldHeight - newHeight) > 1) {
          itemHeightsRef.current.set(id, newHeight);
          dirtyIds.add(id);
        }
      }

      if (dirtyIds.size > 0 && frameId === null) {
        frameId = window.requestAnimationFrame(() => {
          frameId = null;
          dirtyIds.clear();
          setHeightVersion((v) => v + 1);
        });
      }
    });

    itemElementsRef.current.forEach((el) => {
      resizeObserver.observe(el);
    });

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
    };
  }, [items]);

  // Shortest-column bin-packing distribution
  const columnItems: T[][] = [];
  for (let c = 0; c < activeColumnCount; c++) {
    columnItems.push([]);
  }

  const columnHeights = new Array(activeColumnCount).fill(0);

  items.forEach((item) => {
    let shortestIdx = 0;
    let minHeight = columnHeights[0];

    for (let i = 1; i < activeColumnCount; i++) {
      if (columnHeights[i] < minHeight) {
        minHeight = columnHeights[i];
        shortestIdx = i;
      }
    }

    columnItems[shortestIdx].push(item);
    const measuredHeight = itemHeightsRef.current.get(item.id) || 120;
    columnHeights[shortestIdx] += measuredHeight + gap;
  });

  // Snapshot visible rects before DOM commit relative to internal scroll container
  const getContainerScrollParent = (node: HTMLElement | null): HTMLElement | null => {
    let curr = node?.parentElement;
    while (curr) {
      const overflowY = window.getComputedStyle(curr).overflowY;
      if (
        overflowY === "auto" ||
        overflowY === "scroll" ||
        curr.classList.contains("panel-container")
      ) {
        return curr;
      }
      curr = curr.parentElement;
    }
    return null;
  };

  // Pre-layout snapshotting
  const snapshotPositions = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollParent = getContainerScrollParent(container) || container;
    const parentRect = scrollParent.getBoundingClientRect();

    const newSnapshots = new Map<string | number, RectSnapshot>();

    itemElementsRef.current.forEach((el, id) => {
      const rect = el.getBoundingClientRect();
      newSnapshots.set(id, {
        left: rect.left - parentRect.left + scrollParent.scrollLeft,
        top: rect.top - parentRect.top + scrollParent.scrollTop,
        width: rect.width,
        height: rect.height,
      });
    });

    prevRectsRef.current = newSnapshots;
  }, []);

  // Staggered disappear (1 by 1 every 500ms) and appear (500ms after disappearance)
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !enableStagger) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;

    if (prefersReducedMotion) {
      snapshotPositions();
      return;
    }

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      items.forEach((item) => prevItemsRef.current.add(item.id));
      snapshotPositions();
      return;
    }

    const scrollParent = getContainerScrollParent(container) || container;
    const parentRect = scrollParent.getBoundingClientRect();
    const prevRects = prevRectsRef.current;
    const prevItems = prevItemsRef.current;

    // Identify which cards changed visual position (moved column or row)
    const movedCardIds: (string | number)[] = [];

    itemElementsRef.current.forEach((el, id) => {
      if (!prevItems.has(id)) {
        return;
      }

      const prevRect = prevRects.get(id);
      if (!prevRect) return;

      const currentRect = el.getBoundingClientRect();
      const currentPos: RectSnapshot = {
        left: currentRect.left - parentRect.left + scrollParent.scrollLeft,
        top: currentRect.top - parentRect.top + scrollParent.scrollTop,
        width: currentRect.width,
        height: currentRect.height,
      };

      const deltaX = Math.abs(prevRect.left - currentPos.left);
      const deltaY = Math.abs(prevRect.top - currentPos.top);

      // Displaced by more than 8 pixels indicates column or slot movement
      if (deltaX > 8 || deltaY > 8) {
        movedCardIds.push(id);
      }
    });

    // Schedule 1-by-1 disappearance (every 500ms), followed 500ms later by appearance
    movedCardIds.forEach((id, index) => {
      const el = itemElementsRef.current.get(id);
      if (!el) return;

      // Clear any prior pending timers for this element
      const existingTimers = activeTimersRef.current.get(id);
      if (existingTimers) {
        existingTimers.forEach((t) => window.clearTimeout(t));
      }

      const disappearDelay = index * staggerDisappearMs;
      const appearDelay = disappearDelay + staggerAppearDelayMs;

      // Start hidden immediately at the new destination until disappear timer fires
      el.style.opacity = "0";
      el.style.visibility = "hidden";
      el.style.transition = `opacity ${fadeDurationMs}ms ease-out`;

      const t1 = window.setTimeout(() => {
        // Step 1: Disappearance window complete
        el.style.visibility = "hidden";
        el.style.opacity = "0";
      }, disappearDelay);

      const t2 = window.setTimeout(() => {
        // Step 2: Appear 500ms after disappearance at destination
        el.style.visibility = "visible";
        el.style.opacity = "1";

        const tClean = window.setTimeout(() => {
          el.style.transition = "";
          el.style.opacity = "";
          el.style.visibility = "";
        }, fadeDurationMs + 20);

        activeTimersRef.current.get(id)?.push(tClean);
      }, appearDelay);

      activeTimersRef.current.set(id, [t1, t2]);
    });

    // Update references
    prevItemsRef.current = new Set(items.map((i) => i.id));
    snapshotPositions();
  }, [
    items,
    activeColumnCount,
    enableStagger,
    staggerDisappearMs,
    staggerAppearDelayMs,
    fadeDurationMs,
    snapshotPositions,
  ]);

  // Component unmount cleanup
  useEffect(() => {
    const activeTimers = activeTimersRef.current;
    const itemElements = itemElementsRef.current;
    const itemHeights = itemHeightsRef.current;

    return () => {
      activeTimers.forEach((timers) => {
        timers.forEach((t) => window.clearTimeout(t));
      });
      activeTimers.clear();
      itemElements.clear();
      itemHeights.clear();
    };
  }, []);

  return {
    containerRef,
    columnItems,
    registerItemRef,
    activeColumnCount,
  };
}
