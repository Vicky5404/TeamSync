import { useEffect } from 'react';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useUiStore } from '@/store/ui.store';

const THEME_COLORS = { light: '#4f46e5', dark: '#0b0d12' } as const;

/** Applies the theme preference (light/dark/system) to <html>. */
export function ThemeSync() {
  const theme = useUiStore((state) => state.theme);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light);
  }, [dark]);

  return null;
}
