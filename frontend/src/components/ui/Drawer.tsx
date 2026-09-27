import { X } from 'lucide-react';
import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { useOverlay } from '@/hooks/useOverlay';
import { cn } from '@/lib/cn';

import { Button } from './Button';

const WIDTHS = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-3xl',
} as const;

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Accessible title. Rendered in the header unless `header` is provided. */
  title: ReactNode;
  description?: ReactNode;
  /** Custom header content; replaces the default title block. */
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: 'left' | 'right';
  size?: keyof typeof WIDTHS;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  bodyClassName?: string;
}

export function Drawer({ open, ...props }: DrawerProps) {
  if (!open) return null;
  return createPortal(<DrawerContent {...props} />, document.body);
}

function DrawerContent({
  onClose,
  title,
  description,
  header,
  children,
  footer,
  side = 'right',
  size = 'md',
  initialFocusRef,
  className,
  bodyClassName,
}: Omit<DrawerProps, 'open'>) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useOverlay({ open: true, onClose, containerRef: panelRef, initialFocusRef });

  return (
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        className="fixed inset-0 animate-fade-in bg-overlay"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'fixed inset-y-0 flex w-full flex-col bg-surface shadow-2xl outline-none',
          side === 'right'
            ? 'right-0 animate-slide-in-right border-l'
            : 'left-0 animate-slide-in-left border-r',
          WIDTHS[size],
          className,
        )}
      >
        <header className="flex items-start gap-3 border-b px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            {header ? (
              <>
                <h2 id={titleId} className="sr-only">
                  {title}
                </h2>
                {header}
              </>
            ) : (
              <>
                <h2 id={titleId} className="truncate text-base font-semibold">
                  {title}
                </h2>
                {description && (
                  <p id={descriptionId} className="mt-0.5 text-sm text-muted-foreground">
                    {description}
                  </p>
                )}
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close panel"
            onClick={onClose}
            className="-mr-1 text-muted-foreground"
          >
            <X />
          </Button>
        </header>
        <div className={cn('min-h-0 flex-1 overflow-y-auto', bodyClassName)}>{children}</div>
        {footer && <footer className="border-t px-4 py-3 sm:px-5">{footer}</footer>}
      </div>
    </div>
  );
}
