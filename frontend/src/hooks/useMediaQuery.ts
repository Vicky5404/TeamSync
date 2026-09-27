import { useCallback, useSyncExternalStore } from 'react';

/** Subscribe to a CSS media query, e.g. `useMediaQuery('(min-width: 1024px)')`. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Matches Tailwind's `lg` breakpoint, where the persistent sidebar is shown. */
export const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';
