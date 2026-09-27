import { Check } from 'lucide-react';
import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Link, type LinkProps } from 'react-router';

import type { Placement } from '@/hooks/useAnchoredPosition';
import { cn } from '@/lib/cn';

import { DropdownContext, useDropdown } from './dropdown-context';
import { FloatingPanel } from './FloatingPanel';

export interface DropdownTriggerProps {
  ref: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
}

interface DropdownProps {
  trigger: (props: DropdownTriggerProps) => ReactNode;
  children: ReactNode;
  placement?: Placement;
  /** Accessible name for the menu. */
  label?: string;
  className?: string;
}

const ITEM_SELECTOR = '[role^="menuitem"]:not([aria-disabled="true"]):not([disabled])';

function focusItem(menu: HTMLElement | null, position: 'first' | 'last' | 'next' | 'prev') {
  if (!menu) return;
  const items = Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
  if (items.length === 0) return;
  const currentIndex = items.indexOf(document.activeElement as HTMLElement);
  const index =
    position === 'first'
      ? 0
      : position === 'last'
        ? items.length - 1
        : position === 'next'
          ? (currentIndex + 1) % items.length
          : (currentIndex - 1 + items.length) % items.length;
  items[index]?.focus();
}

/** Accessible menu button (WAI-ARIA menu pattern) with full keyboard support. */
export function Dropdown({
  trigger,
  children,
  placement = 'bottom-end',
  label,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  const context = useMemo(() => ({ close }), [close]);

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const position = event.key === 'ArrowDown' ? 'first' : 'last';
      requestAnimationFrame(() => focusItem(menuRef.current, position));
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusItem(menuRef.current, 'next');
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusItem(menuRef.current, 'prev');
        break;
      case 'Home':
        event.preventDefault();
        focusItem(menuRef.current, 'first');
        break;
      case 'End':
        event.preventDefault();
        focusItem(menuRef.current, 'last');
        break;
      case 'Tab':
        event.preventDefault();
        close();
        break;
    }
  };

  return (
    <>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((value) => !value),
        onKeyDown: onTriggerKeyDown,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
      })}
      <DropdownContext.Provider value={context}>
        <FloatingPanel
          open={open}
          onClose={close}
          anchorRef={triggerRef}
          panelRef={menuRef}
          placement={placement}
          id={menuId}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
          className={cn('min-w-48 p-1', className)}
        >
          {children}
        </FloatingPanel>
      </DropdownContext.Provider>
    </>
  );
}

const ITEM_CLASS =
  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-foreground outline-none ' +
  'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none ' +
  'aria-disabled:pointer-events-none aria-disabled:opacity-50 disabled:pointer-events-none disabled:opacity-50 ' +
  '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground';

interface DropdownItemProps extends Omit<ComponentProps<'button'>, 'onSelect'> {
  icon?: ReactNode;
  destructive?: boolean;
  shortcut?: string;
  onSelect?: () => void;
}

export function DropdownItem({
  icon,
  destructive,
  shortcut,
  onSelect,
  className,
  children,
  ...props
}: DropdownItemProps) {
  const { close } = useDropdown();
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={cn(
        ITEM_CLASS,
        destructive && 'text-destructive hover:bg-destructive-soft [&_svg]:text-destructive',
        className,
      )}
      onClick={() => {
        close();
        onSelect?.();
      }}
      {...props}
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <kbd className="text-xs text-muted-foreground">{shortcut}</kbd>}
    </button>
  );
}

interface DropdownLinkItemProps extends LinkProps {
  icon?: ReactNode;
}

export function DropdownLinkItem({
  icon,
  className,
  children,
  onClick,
  ...props
}: DropdownLinkItemProps) {
  const { close } = useDropdown();
  return (
    <Link
      role="menuitem"
      tabIndex={-1}
      className={cn(ITEM_CLASS, className)}
      onClick={(event) => {
        close();
        onClick?.(event);
      }}
      {...props}
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
    </Link>
  );
}

interface DropdownCheckboxItemProps extends Omit<ComponentProps<'button'>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon?: ReactNode;
}

/** Toggle item that keeps the menu open (multi-select filters). */
export function DropdownCheckboxItem({
  checked,
  onCheckedChange,
  icon,
  className,
  children,
  ...props
}: DropdownCheckboxItemProps) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      tabIndex={-1}
      className={cn(ITEM_CLASS, className)}
      onClick={() => onCheckedChange(!checked)}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-4 items-center justify-center rounded border',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
        )}
      >
        {checked && <Check className="size-3! text-primary-foreground!" strokeWidth={3} />}
      </span>
      {icon}
      <span className="flex-1 truncate">{children}</span>
    </button>
  );
}

interface DropdownRadioItemProps extends Omit<ComponentProps<'button'>, 'onSelect'> {
  checked: boolean;
  onSelect: () => void;
  icon?: ReactNode;
}

export function DropdownRadioItem({
  checked,
  onSelect,
  icon,
  className,
  children,
  ...props
}: DropdownRadioItemProps) {
  const { close } = useDropdown();
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      tabIndex={-1}
      className={cn(ITEM_CLASS, className)}
      onClick={() => {
        onSelect();
        close();
      }}
      {...props}
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {checked && <Check aria-hidden="true" className="text-primary!" />}
    </button>
  );
}

export function DropdownSeparator() {
  return <div role="separator" className="-mx-1 my-1 h-px bg-border" />;
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">{children}</div>
  );
}
