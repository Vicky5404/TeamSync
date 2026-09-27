import { X } from 'lucide-react';
import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { useOverlay } from '@/hooks/useOverlay';
import { cn } from '@/lib/cn';

import { Button } from './Button';

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Action row; forms typically render submit buttons here with `form="<id>"`. */
  footer?: ReactNode;
  size?: keyof typeof SIZES;
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Blocks closing (Escape, overlay, close button) — e.g. while submitting. */
  preventClose?: boolean;
  closeOnOverlayClick?: boolean;
  className?: string;
}

export function Modal({ open, ...props }: ModalProps) {
  if (!open) return null;
  return createPortal(<ModalContent {...props} />, document.body);
}

function ModalContent({
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocusRef,
  preventClose = false,
  closeOnOverlayClick = true,
  className,
}: Omit<ModalProps, 'open'>) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useOverlay({
    open: true,
    onClose,
    containerRef: panelRef,
    initialFocusRef,
    closeOnEscape: !preventClose,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        aria-hidden="true"
        className="fixed inset-0 animate-fade-in bg-overlay"
        onClick={closeOnOverlayClick && !preventClose ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full animate-pop-in flex-col rounded-t-2xl border bg-surface shadow-xl outline-none sm:rounded-xl',
          SIZES[size],
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close dialog"
            onClick={onClose}
            disabled={preventClose}
            className="-mt-1 -mr-2 text-muted-foreground"
          >
            <X />
          </Button>
        </header>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>}
        {footer && (
          <footer className="flex flex-col-reverse gap-2 border-t px-5 py-3 sm:flex-row sm:justify-end">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
