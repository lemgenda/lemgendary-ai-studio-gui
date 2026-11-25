import React, { ReactNode } from "react";
import { useMasonryFlip, UseMasonryFlipOptions } from "../../hooks/useMasonryFlip";

export interface MasonryFlipGridProps<T extends { id: string | number }> {
  items: T[];
  renderItem: (item: T) => ReactNode;
  options?: UseMasonryFlipOptions;
  className?: string;
  columnClassName?: string;
  emptyState?: ReactNode;
}

export function MasonryFlipGrid<T extends { id: string | number }>({
  items,
  renderItem,
  options,
  className = "",
  columnClassName = "",
  emptyState = null,
}: MasonryFlipGridProps<T>): React.JSX.Element {
  const { containerRef, columnItems, registerItemRef, activeColumnCount } = useMasonryFlip(
    items,
    options
  );

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div
      ref={containerRef}
      className={`masonry-grid ${className}`.trim()}
      style={{
        display: "flex",
        gap: `${options?.gap ?? 20}px`,
        width: "100%",
        alignItems: "flex-start",
      }}
    >
      {columnItems.slice(0, activeColumnCount).map((column, colIdx) => (
        <div
          key={colIdx}
          className={`masonry-column ${columnClassName}`.trim()}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: `${options?.gap ?? 20}px`,
            minWidth: "320px",
          }}
        >
          {column.map((item) => (
            <div
              key={item.id}
              data-masonry-id={item.id}
              ref={(el) => registerItemRef(item.id, el)}
              style={{
                width: "100%",
                contain: "paint",
              }}
            >
              {renderItem(item)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
