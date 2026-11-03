/**
 * LemGendary AI Studio - accessible tabs: `role="tablist"` with only tabs
 * inside, `aria-selected`, `aria-controls` pointing at a real tab panel,
 * roving tab index and arrow / Home / End keys.
 *
 * Only the active panel is rendered, so every tab of one list controls the
 * same `TabPanel` element (`${idPrefix}-panel`), labelled by the active tab.
 */

import React, { useRef } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: React.ReactNode;
  /** DOM id of the tab button; defaults to `${idPrefix}-tab-${id}`. */
  domId?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export interface TabListProps<T extends string> {
  idPrefix: string;
  /** Accessible name of the tab list. */
  label: string;
  items: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Class of each tab button for its selected state. */
  tabClassName: (selected: boolean) => string;
  className?: string;
  style?: React.CSSProperties;
  tabStyle?: React.CSSProperties;
}

export function tabDomId<T extends string>(idPrefix: string, item: TabItem<T>): string {
  return item.domId ?? `${idPrefix}-tab-${item.id}`;
}

export function tabPanelId(idPrefix: string): string {
  return `${idPrefix}-panel`;
}

export function TabList<T extends string>({
  idPrefix,
  label,
  items,
  value,
  onChange,
  tabClassName,
  className,
  style,
  tabStyle,
}: TabListProps<T>): React.ReactElement {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (index: number) => {
    const enabled = items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0);
    if (enabled.length === 0) return;
    const target = enabled.includes(index) ? index : enabled[0];
    buttonsRef.current[target]?.focus();
    onChange(items[target].id);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    focusTab(next);
  };

  return (
    <div role="tablist" aria-label={label} className={className} style={style}>
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              buttonsRef.current[index] = el;
            }}
            id={tabDomId(idPrefix, item)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={tabPanelId(idPrefix)}
            aria-label={item.ariaLabel}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className={tabClassName(selected)}
            style={tabStyle}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps<T extends string> {
  idPrefix: string;
  items: readonly TabItem<T>[];
  value: T;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function TabPanel<T extends string>({
  idPrefix,
  items,
  value,
  className,
  style,
  children,
}: TabPanelProps<T>): React.ReactElement {
  const active = items.find((item) => item.id === value) ?? items[0];
  return (
    <div
      id={tabPanelId(idPrefix)}
      role="tabpanel"
      aria-labelledby={active ? tabDomId(idPrefix, active) : undefined}
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}
