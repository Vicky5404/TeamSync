import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { NavLink } from 'react-router';

import { cn } from '@/lib/cn';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  count?: number;
  disabled?: boolean;
}

interface TabsProps<T extends string> {
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onValueChange: (value: T) => void;
  /** Prefix used to connect tabs with their panels (`<TabPanel idBase=…>`). */
  idBase: string;
  label: string;
  className?: string;
}

const tabId = (base: string, value: string) => `${base}-tab-${value}`;
const panelId = (base: string, value: string) => `${base}-panel-${value}`;

const TAB_CLASS =
  'relative inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors ' +
  'hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring disabled:opacity-50 ' +
  '[&_svg]:size-4';

/** Accessible tabs (WAI-ARIA tabs pattern, automatic activation). */
export function Tabs<T extends string>({
  items,
  value,
  onValueChange,
  idBase,
  label,
  className,
}: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.filter((item) => !item.disabled);
    const currentIndex = enabled.findIndex((item) => item.value === value);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % enabled.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + enabled.length) % enabled.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = enabled.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = enabled[nextIndex];
    if (!next) return;
    onValueChange(next.value);
    listRef.current
      ?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabId(idBase, next.value))}`)
      ?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('relative flex scrollbar-thin gap-1 overflow-x-auto border-b', className)}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            id={tabId(idBase, item.value)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(idBase, item.value)}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            className={cn(
              TAB_CLASS,
              'mb-[-1px] rounded-b-none border-b-2 border-transparent',
              selected && 'border-primary text-foreground',
            )}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined && (
              <span className="rounded-full bg-surface-muted px-1.5 text-xs text-muted-foreground tabular-nums">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface TabPanelProps {
  idBase: string;
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ idBase, value, children, className }: TabPanelProps) {
  return (
    <div
      id={panelId(idBase, value)}
      role="tabpanel"
      aria-labelledby={tabId(idBase, value)}
      tabIndex={0}
      className={cn('outline-none', className)}
    >
      {children}
    </div>
  );
}

export interface TabNavItem {
  to: string;
  label: ReactNode;
  icon?: ReactNode;
  end?: boolean;
}

/** Route-driven tab navigation: each tab is a link, the active one marked with `aria-current`. */
export function TabNav({
  items,
  label,
  className,
}: {
  items: readonly TabNavItem[];
  label: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn('relative -mb-px scrollbar-thin overflow-x-auto', className)}
    >
      <ul className="flex gap-1">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  TAB_CLASS,
                  'rounded-b-none border-b-2 border-transparent',
                  isActive && 'border-primary text-foreground',
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
