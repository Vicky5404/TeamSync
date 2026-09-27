import { useRef, type ComponentProps, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { useAnchoredPosition, type Placement } from '@/hooks/useAnchoredPosition';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useOverlay } from '@/hooks/useOverlay';
import { cn } from '@/lib/cn';

export interface FloatingPanelProps extends Omit<ComponentProps<'div'>, 'ref'> {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  placement?: Placement;
  trapFocus?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  panelRef?: RefObject<HTMLDivElement | null>;
}

/**
 * Low-level anchored layer used by Popover and Dropdown: portal, viewport-aware
 * positioning, outside-click + Escape dismissal and focus management.
 */
export function FloatingPanel({ open, ...props }: FloatingPanelProps) {
  if (!open) return null;
  return createPortal(<FloatingPanelContent {...props} />, document.body);
}

function FloatingPanelContent({
  onClose,
  anchorRef,
  placement = 'bottom-start',
  trapFocus = false,
  initialFocusRef,
  panelRef,
  className,
  style,
  children,
  ...props
}: Omit<FloatingPanelProps, 'open'>) {
  const localRef = useRef<HTMLDivElement>(null);
  const ref = panelRef ?? localRef;

  useOverlay({
    open: true,
    onClose,
    containerRef: ref,
    initialFocusRef,
    lockScroll: false,
    trapFocus,
  });
  useAnchoredPosition(anchorRef, ref, true, placement);
  useClickOutside([ref, anchorRef], onClose);

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', top: 0, left: 0, ...style }}
      className={cn(
        'z-50 animate-pop-in overflow-y-auto rounded-xl border bg-surface-raised shadow-lg outline-none',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
