import { useCallback, useId, useRef, useState, type ReactNode, type RefObject } from 'react';

import type { Placement } from '@/hooks/useAnchoredPosition';
import { cn } from '@/lib/cn';

import { FloatingPanel } from './FloatingPanel';

export interface PopoverTriggerProps {
  ref: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
  'aria-expanded': boolean;
  'aria-haspopup': 'dialog';
  'aria-controls': string | undefined;
}

interface PopoverProps {
  trigger: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  /** Accessible name for the popover dialog. */
  label: string;
  placement?: Placement;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/** Non-modal anchored dialog (filters, notification center, pickers). */
export function Popover({
  trigger,
  children,
  label,
  placement = 'bottom-start',
  className,
  open: controlledOpen,
  onOpenChange,
  initialFocusRef,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange],
  );
  const close = useCallback(() => setOpen(false), [setOpen]);

  return (
    <>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen(!open),
        'aria-expanded': open,
        'aria-haspopup': 'dialog',
        'aria-controls': open ? panelId : undefined,
      })}
      <FloatingPanel
        open={open}
        onClose={close}
        anchorRef={triggerRef}
        placement={placement}
        trapFocus
        initialFocusRef={initialFocusRef}
        id={panelId}
        role="dialog"
        aria-label={label}
        tabIndex={-1}
        className={cn('w-72', className)}
      >
        {typeof children === 'function' ? children(close) : children}
      </FloatingPanel>
    </>
  );
}
