import { useEffect, useEffectEvent, useId, type RefObject } from 'react';

/**
 * Shared behaviour for modal-like layers (Modal, Drawer, Popover, Dropdown):
 * - a global stack so only the top-most layer reacts to Escape / traps focus
 * - optional focus trap and body scroll lock
 * - initial focus on open and focus restoration on close
 */

const layerStack: string[] = [];
let scrollLockCount = 0;
let previousBodyOverflow = '';
let previousBodyPaddingRight = '';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute('inert') && element.getClientRects().length > 0,
  );
}

function lockScroll() {
  if (scrollLockCount === 0) {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    previousBodyOverflow = document.body.style.overflow;
    previousBodyPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
  scrollLockCount += 1;
}

function unlockScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
    document.body.style.paddingRight = previousBodyPaddingRight;
  }
}

interface UseOverlayOptions {
  open: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  lockScroll?: boolean;
  trapFocus?: boolean;
  restoreFocus?: boolean;
  /** When false, Escape does not close the layer (e.g. while a request is pending). */
  closeOnEscape?: boolean;
}

export function useOverlay({
  open,
  onClose,
  containerRef,
  initialFocusRef,
  lockScroll: shouldLockScroll = true,
  trapFocus = true,
  restoreFocus = true,
  closeOnEscape = true,
}: UseOverlayOptions): void {
  const id = useId();
  const handleClose = useEffectEvent(() => onClose());
  const canEscape = useEffectEvent(() => closeOnEscape);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    layerStack.push(id);
    if (shouldLockScroll) lockScroll();

    const frame = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container || container.contains(document.activeElement)) return;
      const target = initialFocusRef?.current ?? getFocusableElements(container)[0] ?? container;
      target.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (layerStack[layerStack.length - 1] !== id) return;

      if (event.key === 'Escape' && !event.defaultPrevented) {
        if (!canEscape()) return;
        event.preventDefault();
        handleClose();
        return;
      }

      if (event.key === 'Tab' && trapFocus) {
        const container = containerRef.current;
        if (!container) return;
        const focusable = getFocusableElements(container);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) {
          event.preventDefault();
          container.focus();
          return;
        }
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !container.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !container.contains(active))) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      const index = layerStack.lastIndexOf(id);
      if (index !== -1) layerStack.splice(index, 1);
      if (shouldLockScroll) unlockScroll();
      // Only restore when focus was lost with the layer (not when the user
      // dismissed it by clicking into another control).
      const focusLost =
        !document.activeElement ||
        document.activeElement === document.body ||
        !document.activeElement.isConnected;
      if (restoreFocus && focusLost && previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open, id, shouldLockScroll, trapFocus, restoreFocus, containerRef, initialFocusRef]);
}
