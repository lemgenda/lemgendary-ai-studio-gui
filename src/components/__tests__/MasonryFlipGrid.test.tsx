// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MasonryFlipGrid } from "../ui/MasonryFlipGrid";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("MasonryFlipGrid staggered disappear/appear animation", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    vi.useRealTimers();
  });

  it("renders items across columns with staggered timing options", () => {
    const items = [
      { id: "model-1", title: "Model 1" },
      { id: "model-2", title: "Model 2" },
      { id: "model-3", title: "Model 3" },
    ];

    act(() => {
      root?.render(
        <MasonryFlipGrid
          items={items}
          renderItem={(item) => (
            <div data-testid={`card-${item.id}`}>{item.title}</div>
          )}
          options={{
            columnCount: 2,
            staggerDisappearMs: 500,
            staggerAppearDelayMs: 500,
          }}
        />
      );
    });

    const columns = container?.querySelectorAll(".masonry-column");
    expect(columns?.length).toBe(2);

    const cards = container?.querySelectorAll("[data-masonry-id]");
    expect(cards?.length).toBe(3);
  });

  it("updates and schedules transitions when items change", () => {
    const initialItems = [
      { id: "card-a", title: "Card A" },
      { id: "card-b", title: "Card B" },
    ];

    act(() => {
      root?.render(
        <MasonryFlipGrid
          items={initialItems}
          renderItem={(item) => <div>{item.title}</div>}
          options={{
            columnCount: 2,
            staggerDisappearMs: 500,
            staggerAppearDelayMs: 500,
          }}
        />
      );
    });

    const updatedItems = [
      { id: "card-b", title: "Card B" },
      { id: "card-a", title: "Card A" },
    ];

    act(() => {
      root?.render(
        <MasonryFlipGrid
          items={updatedItems}
          renderItem={(item) => <div>{item.title}</div>}
          options={{
            columnCount: 2,
            staggerDisappearMs: 500,
            staggerAppearDelayMs: 500,
          }}
        />
      );
    });

    // Advance 500ms (disappearance step)
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Advance next 500ms (reappearance step)
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(container?.querySelectorAll(".masonry-column").length).toBe(2);
  });
});
