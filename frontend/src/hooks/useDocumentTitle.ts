import { useEffect } from 'react';

import { env } from '@/lib/env';

/** Sets `document.title` to "<title> · <app name>" while mounted. */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} · ${env.appName}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
