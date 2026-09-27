import { useEffect, useEffectEvent } from 'react';

const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** Display label for the platform modifier key. */
export const MOD_KEY_LABEL = IS_MAC ? '⌘' : 'Ctrl';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

interface HotkeyOptions {
  enabled?: boolean;
  /** Fire even while typing in inputs (useful for `mod+…` combos). */
  allowInInputs?: boolean;
}

/**
 * Register a global keyboard shortcut. `combo` is `key` or `mod+key`, where
 * `mod` is ⌘ on macOS and Ctrl elsewhere, e.g. `mod+k` or `/`.
 */
export function useHotkey(
  combo: string,
  handler: (event: KeyboardEvent) => void,
  { enabled = true, allowInInputs = false }: HotkeyOptions = {},
): void {
  const onHotkey = useEffectEvent(handler);

  useEffect(() => {
    if (!enabled) return;
    const parts = combo.toLowerCase().split('+');
    const key = parts[parts.length - 1];
    const needsMod = parts.includes('mod');
    const needsShift = parts.includes('shift');

    const listener = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key) return;
      const modPressed = IS_MAC ? event.metaKey : event.ctrlKey;
      if (needsMod !== modPressed || needsShift !== event.shiftKey || event.altKey) return;
      if (!allowInInputs && isEditableTarget(event.target)) return;
      event.preventDefault();
      onHotkey(event);
    };

    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [combo, enabled, allowInInputs]);
}
