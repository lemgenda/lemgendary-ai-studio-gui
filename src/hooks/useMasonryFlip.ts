import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface UseMasonryFlipOptions {
  columnCount?: number;
  gap?: number;
  transitionDurationMs?: number;
  easing?: string;
  enableFlip?: boolean;
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

const DEFAULT_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const DEFAULT_DURATION_MS = 280;
const DEFAULT_GAP = 20;

export function useMasonryFlip<T extends { id: string | number }>(
  items: T[],
  options: UseMasonryFlipOptions = {}
): UseMasonryFlipReturn<T> {
  const {
    columnCount: requestedColumnCount,
    gap = DEFAULT_GAP,
    transitionDurationMs = DEFAULT_DURATION_MS,
    easing = DEFAULT_EASING,
    enableFlip = true,
  } = options;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemElementsRef = useRef<Map<string | number, HTMLElement>>(new Map());
  const itemHeightsRef = useRef<Map<string | number, number>>(new Map());
  const prevRectsRef = useRef<Map<string | number, RectSnapshot>>(new Map());
  const rafIdsRef = useRef<Map<string | number, number>>(new Map());
  const transitionCleanupRef = useRef<Map<string | number, () => void>>(new Map());
  const isInitialMountRef = useRef<boolean>(true);
  const prevItemsRef = useRef<Set<string | number>>(new Set());

  // Dynamic responsive columns calculation based on container width if columnCount is not fixed
  const [measuredColumnCount, setMeasuredColumnCount] = useState<number>(3);

  const determineColumns = useCallback((width: number): number => {
    if (requestedColumnCount && requestedColumnCount > 0) {
      return requestedColumnCount;
    }
    if (width <= 680) {
      return 1;
    }
    if (width <= 1100) {
      return 2;
    }
    return 3;
  }, [requestedColumnCount]);

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
    // Find column with the lowest cumulative height
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
      if (overflowY === "auto" || overflowY === "scroll" || curr.classList.contains("panel-container")) {
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

  // FLIP animation engine executed right after layout paint
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !enableFlip) return;

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

    itemElementsRef.current.forEach((el, id) => {
      // Skip FLIP for newly added or filtered-in items
      if (!prevItems.has(id)) {
        return;
      }

      const prevRect = prevRects.get(id);
      if (!prevRect) return;

      // Cancel any ongoing RAF or transition listener for this card
      const ongoingRaf = rafIdsRef.current.get(id);
      if (ongoingRaf !== undefined) {
        window.cancelAnimationFrame(ongoingRaf);
        rafIdsRef.current.delete(id);
      }

      const cleanupFn = transitionCleanupRef.current.get(id);
      if (cleanupFn) {
        cleanupFn();
        transitionCleanupRef.current.delete(id);
      }

      const currentRect = el.getBoundingClientRect();
      const currentPos: RectSnapshot = {
        left: currentRect.left - parentRect.left + scrollParent.scrollLeft,
        top: currentRect.top - parentRect.top + scrollParent.scrollTop,
        width: currentRect.width,
        height: currentRect.height,
      };

      const deltaX = prevRect.left - currentPos.left;
      const deltaY = prevRect.top - currentPos.top;

      // Only animate if delta is non-trivial (> 0.5px)
      if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
        // Invert: apply inverse transform immediately without transition
        el.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
        el.style.transition = "none";
        el.style.willChange = "transform";
        el.style.zIndex = "10";

        // Play: schedule transition back to origin
        const rafId = window.requestAnimationFrame(() => {
          el.style.transition = `transform ${transitionDurationMs}ms ${easing}`;
          el.style.transform = "translate3d(0, 0, 0)";

          const handleTransitionEnd = (event: TransitionEvent) => {
            if (event.propertyName !== "transform" || event.target !== el) {
              return;
            }
            el.style.transition = "";
            el.style.transform = "";
            el.style.willChange = "";
            el.style.zIndex = "";
            el.removeEventListener("transitionend", handleTransitionEnd);
            transitionCleanupRef.current.delete(id);
          };

          el.addEventListener("transitionend", handleTransitionEnd);
          transitionCleanupRef.current.set(id, () => {
            el.removeEventListener("transitionend", handleTransitionEnd);
            el.style.transition = "";
            el.style.transform = "";
            el.style.willChange = "";
            el.style.zIndex = "";
          });
        });

        rafIdsRef.current.set(id, rafId);
      }
    });

    // Update references
    prevItemsRef.current = new Set(items.map((i) => i.id));
    snapshotPositions();
  }, [items, activeColumnCount, enableFlip, easing, transitionDurationMs, snapshotPositions]);

  // Component unmount cleanup
  useEffect(() => {
    const rafIds = rafIdsRef.current;
    const transitionCleanups = transitionCleanupRef.current;
    const itemElements = itemElementsRef.current;
    const itemHeights = itemHeightsRef.current;

    return () => {
      rafIds.forEach((rafId) => window.cancelAnimationFrame(rafId));
      rafIds.clear();
      transitionCleanups.forEach((cleanup) => cleanup());
      transitionCleanups.clear();
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
