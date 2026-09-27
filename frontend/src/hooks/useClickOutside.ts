import { useEffect, useEffectEvent, type RefObject } from 'react';

/** Calls `handler` when a pointer interaction starts outside all given elements. */
export function useClickOutside(
  refs: ReadonlyArray<RefObject<HTMLElement | null>>,
  handler: (event: PointerEvent) => void,
  enabled = true,
): void {
  const onOutside = useEffectEvent((event: PointerEvent) => {
    const target = event.target as Node | null;
    const inside = refs.some((ref) => ref.current && target && ref.current.contains(target));
    if (!inside) handler(event);
  });

  useEffect(() => {
    if (!enabled) return;
    const listener = (event: PointerEvent) => onOutside(event);
    document.addEventListener('pointerdown', listener, true);
    return () => document.removeEventListener('pointerdown', listener, true);
  }, [enabled]);
}
