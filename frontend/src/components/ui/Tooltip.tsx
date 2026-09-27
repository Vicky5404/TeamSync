import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { useAnchoredPosition, type Placement } from '@/hooks/useAnchoredPosition';
import { cn } from '@/lib/cn';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  placement?: Placement;
  /** Delay before showing on hover, in ms. Focus shows immediately. */
  delay?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Supplementary hint shown on hover and keyboard focus. Never put essential
 * information only in a tooltip — icon buttons still need an `aria-label`.
 */
export function Tooltip({
  content,
  children,
  placement = 'top-center',
  delay = 350,
  disabled = false,
  className,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const show = (immediate = false) => {
    if (disabled) return;
    clearTimeout(timerRef.current);
    if (immediate) setOpen(true);
    else timerRef.current = setTimeout(() => setOpen(true), delay);
  };

  const hide = () => {
    clearTimeout(timerRef.current);
    setOpen(false);
  };

  return (
    <>
      <span
        ref={anchorRef}
        className={cn('inline-flex', className)}
        onPointerEnter={() => show()}
        onPointerLeave={hide}
        onFocus={() => show(true)}
        onBlur={hide}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation();
            hide();
          }
        }}
        aria-describedby={open ? id : undefined}
      >
        {children}
      </span>
      {open &&
        !disabled &&
        createPortal(
          <TooltipContent id={id} anchorRef={anchorRef} placement={placement}>
            {content}
          </TooltipContent>,
          document.body,
        )}
    </>
  );
}

function TooltipContent({
  id,
  anchorRef,
  placement,
  children,
}: {
  id: string;
  anchorRef: RefObject<HTMLElement | null>;
  placement: Placement;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useAnchoredPosition(anchorRef, ref, true, placement, 6);
  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      style={{ position: 'fixed', top: 0, left: 0 }}
      className="pointer-events-none z-[60] max-w-xs animate-fade-in rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md"
    >
      {children}
    </div>
  );
}
