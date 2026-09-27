import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import { refreshSession, toApiError } from '@/lib/http';
import { useAuthStore } from '@/store/auth.store';

import { RealtimeClient } from './client';
import type { RealtimeStatus } from './events';
import { RealtimeContext, type RealtimeContextValue } from './realtime-context';

/** Registers event handlers on a client; returns a cleanup function. */
export type RealtimeRegistration = (client: RealtimeClient, queryClient: QueryClient) => () => void;

interface RealtimeProviderProps {
  /** WebSocket endpoint. When null, real-time is disabled and the app polls instead. */
  url: string | null;
  /** Channel to subscribe to, typically `organization:<id>`. */
  channel: string | null;
  registrations: readonly RealtimeRegistration[];
  children: ReactNode;
}

const noopUnsubscribe = () => undefined;

/**
 * The socket's access token expired (e.g. a reconnect after the laptop slept):
 * refresh the session and reconnect. A rejected refresh ends the session.
 */
async function refreshAfterRejectedToken(): Promise<boolean> {
  try {
    await refreshSession();
    return true;
  } catch (error) {
    if (toApiError(error).isUnauthorized) {
      useAuthStore.getState().expireSession();
      return false;
    }
    // Network trouble: keep reconnecting with backoff.
    return true;
  }
}

export function RealtimeProvider({ url, channel, registrations, children }: RealtimeProviderProps) {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  // Construction is side-effect free; connecting happens in the effect below.
  const client = useMemo(
    () =>
      url && isAuthenticated
        ? new RealtimeClient({
            url,
            getAccessToken: () => useAuthStore.getState().accessToken,
            onAuthFailure: refreshAfterRejectedToken,
            // Events aren't replayed after a dropped connection (API restart,
            // network change): refetch what is on screen, mark the rest stale.
            onReconnect: () => void queryClient.invalidateQueries(),
          })
        : null,
    [url, isAuthenticated, queryClient],
  );

  const status = useSyncExternalStore<RealtimeStatus>(
    (listener) => client?.subscribeStatus(listener) ?? noopUnsubscribe,
    () => client?.currentStatus ?? 'idle',
  );

  useEffect(() => {
    if (!client) return;
    const cleanups = registrations.map((register) => register(client, queryClient));
    client.connect();
    return () => {
      cleanups.forEach((cleanup) => cleanup());
      client.disconnect();
    };
  }, [client, registrations, queryClient]);

  useEffect(() => {
    if (!client || !channel) return;
    return client.subscribeChannel(channel);
  }, [client, channel]);

  const value = useMemo<RealtimeContextValue>(
    () => ({ client, status, isLive: status === 'open' }),
    [client, status],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
