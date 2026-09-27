import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { toApiError } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { authService } from '@/services';
import { useAuthStore } from '@/store/auth.store';

const MAX_RESTORE_DELAY_MS = 30_000;

/**
 * Restores the session on startup (refresh cookie → access token) and clears
 * all cached server state whenever the session ends. If the API can't be
 * reached, the session is kept and restoring is retried with backoff instead of
 * signing the user out.
 */
export function SessionManager() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (useAuthStore.getState().status !== 'unknown') return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const restore = () => {
      authService
        .refresh()
        .then((session) => {
          if (cancelled) return;
          queryClient.setQueryData(queryKeys.auth.me(), session.user);
          useAuthStore.getState().setSession(session.accessToken);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          const apiError = toApiError(error);
          if (!apiError.isRetryable) {
            // No (valid) refresh cookie: signed out.
            useAuthStore.getState().clearSession();
            return;
          }
          attempt += 1;
          useAuthStore.getState().setRestoreError(apiError.message);
          retryTimer = setTimeout(restore, Math.min(MAX_RESTORE_DELAY_MS, 1000 * 2 ** attempt));
        });
    };
    restore();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [queryClient]);

  useEffect(
    () =>
      useAuthStore.subscribe((state, previous) => {
        if (previous.status === 'authenticated' && state.status === 'unauthenticated') {
          // Drop every cached query so no data leaks into the next session.
          queryClient.removeQueries();
        }
      }),
    [queryClient],
  );

  return null;
}
