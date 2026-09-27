import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { ApiError, ERROR_CODES, getErrorMessage } from '@/lib/http';
import { toast } from '@/store/toast.store';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      /** Set to false to silence the toast for failed background refetches. */
      errorToast?: boolean;
    };
    mutationMeta: {
      /** Set to false when the caller renders the error itself (e.g. inline in a form). */
      errorToast?: boolean;
    };
  }
}

function isSilent(error: unknown): boolean {
  return error instanceof ApiError && error.code === ERROR_CODES.CANCELED;
}

function errorTitle(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.isNetworkError) return "Can't reach the server";
  if (error.isForbidden) return 'Permission denied';
  if (error.isNotFound) return 'No longer available';
  if (error.status === 409) return 'Conflicting change';
  if (error.status === 429) return 'Too many requests';
  return fallback;
}

/** Error message plus, for server errors, the request id support can look up in the API logs. */
function errorDescription(error: unknown): string {
  const message = getErrorMessage(error);
  return error instanceof ApiError && error.status >= 500 && error.requestId
    ? `${message} (Reference: ${error.requestId})`
    : message;
}

export function createQueryClient(): QueryClient {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Initial load failures render inline error states with a retry button.
        // Failures while stale data is already on screen are surfaced as a toast.
        if (query.state.data === undefined || query.meta?.errorToast === false || isSilent(error)) {
          return;
        }
        toast.error("Couldn't refresh data", { description: errorDescription(error) });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _onMutateResult, mutation) => {
        if (isSilent(error)) return;
        // Someone else deleted or changed what this mutation targeted: refresh what's on screen.
        if (error instanceof ApiError && (error.isNotFound || error.status === 409)) {
          void queryClient.invalidateQueries();
        }
        if (mutation.meta?.errorToast === false) return;
        toast.error(errorTitle(error, 'Something went wrong'), {
          description: errorDescription(error),
        });
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        // Only retry transient failures (network, 5xx, 429) — never 4xx.
        retry: (failureCount, error) =>
          error instanceof ApiError && !error.isRetryable ? false : failureCount < 2,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
  return queryClient;
}
