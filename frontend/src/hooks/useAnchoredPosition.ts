import { useLayoutEffect, type RefObject } from 'react';

export type Placement =
  'bottom-start' | 'bottom-end' | 'bottom-center' | 'top-start' | 'top-end' | 'top-center';

const VIEWPORT_PADDING = 8;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Positions a `position: fixed` floating element next to its anchor, flipping
 * vertically when there is not enough room and staying inside the viewport.
 * Styles are written directly to the element to avoid re-rendering on scroll.
 */
export function useAnchoredPosition(
  anchorRef: RefObject<HTMLElement | null>,
  floatingRef: RefObject<HTMLElement | null>,
  open: boolean,
  placement: Placement = 'bottom-start',
  offset = 6,
): void {
  useLayoutEffect(() => {
    if (!open) return;

    const update = () => {
      const anchor = anchorRef.current;
      const floating = floatingRef.current;
      if (!anchor || !floating) return;

      const anchorRect = anchor.getBoundingClientRect();
      const floatingRect = floating.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight;
      const [side, align] = placement.split('-') as ['top' | 'bottom', 'start' | 'end' | 'center'];

      const below = anchorRect.bottom + offset;
      const above = anchorRect.top - floatingRect.height - offset;
      const fitsBelow = below + floatingRect.height <= viewportHeight - VIEWPORT_PADDING;
      const fitsAbove = above >= VIEWPORT_PADDING;

      let top =
        side === 'top'
          ? fitsAbove || !fitsBelow
            ? above
            : below
          : fitsBelow || !fitsAbove
            ? below
            : above;

      let left =
        align === 'end'
          ? anchorRect.right - floatingRect.width
          : align === 'center'
            ? anchorRect.left + anchorRect.width / 2 - floatingRect.width / 2
            : anchorRect.left;

      left = clamp(left, VIEWPORT_PADDING, viewportWidth - floatingRect.width - VIEWPORT_PADDING);
      top = clamp(
        top,
        VIEWPORT_PADDING,
        Math.max(VIEWPORT_PADDING, viewportHeight - floatingRect.height - VIEWPORT_PADDING),
      );

      floating.style.top = `${Math.round(top)}px`;
      floating.style.left = `${Math.round(left)}px`;
      floating.style.maxHeight = `${viewportHeight - VIEWPORT_PADDING * 2}px`;
    };

    update();
    const observer = new ResizeObserver(update);
    if (anchorRef.current) observer.observe(anchorRef.current);
    if (floatingRef.current) observer.observe(floatingRef.current);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, placement, offset, anchorRef, floatingRef]);
}
