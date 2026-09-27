import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { useRealtime } from '@/lib/realtime/realtime-context';
import { queryKeys } from '@/lib/query-keys';
import { notificationsService } from '@/services';
import type {
  CursorPage,
  Notification,
  NotificationFilter,
  NotificationPreferences,
} from '@/types';

const PAGE_SIZE = 20;
/** Fallback polling interval when the WebSocket is not connected. */
const POLL_INTERVAL_MS = 60_000;

export function useNotifications(filter: NotificationFilter) {
  return useInfiniteQuery({
    queryKey: queryKeys.notifications.list(filter),
    queryFn: ({ pageParam, signal }) =>
      notificationsService.list(
        { filter, cursor: pageParam ?? undefined, limit: PAGE_SIZE },
        signal,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export function useUnreadCount() {
  const { isLive } = useRealtime();
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: ({ signal }) => notificationsService.unreadCount(signal),
    refetchInterval: isLive ? false : POLL_INTERVAL_MS,
    staleTime: 15_000,
  });
}

type NotificationPages = InfiniteData<CursorPage<Notification>, string | null>;

function markInCache(
  data: NotificationPages | undefined,
  predicate: (notification: Notification) => boolean,
  readAt: string,
): NotificationPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: page.data.map((notification) =>
        predicate(notification) && !notification.readAt
          ? { ...notification, readAt }
          : notification,
      ),
    })),
  };
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => notificationsService.markRead(notificationId),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all() });
      const lists = queryClient.getQueriesData<NotificationPages>({
        queryKey: queryKeys.notifications.lists(),
      });
      const count = queryClient.getQueryData<number>(queryKeys.notifications.unreadCount());
      const wasUnread = lists.some(([, data]) =>
        data?.pages.some((page) =>
          page.data.some((item) => item.id === notificationId && !item.readAt),
        ),
      );
      const now = new Date().toISOString();
      queryClient.setQueriesData<NotificationPages>(
        { queryKey: queryKeys.notifications.lists() },
        (data) => markInCache(data, (item) => item.id === notificationId, now),
      );
      if (wasUnread && count !== undefined) {
        queryClient.setQueryData(queryKeys.notifications.unreadCount(), Math.max(0, count - 1));
      }
      return { lists, count };
    },
    onError: (_error, _id, context) => {
      context?.lists.forEach(([key, data]) => queryClient.setQueryData(key, data));
      if (context?.count !== undefined) {
        queryClient.setQueryData(queryKeys.notifications.unreadCount(), context.count);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all() });
      const lists = queryClient.getQueriesData<NotificationPages>({
        queryKey: queryKeys.notifications.lists(),
      });
      const count = queryClient.getQueryData<number>(queryKeys.notifications.unreadCount());
      const now = new Date().toISOString();
      queryClient.setQueriesData<NotificationPages>(
        { queryKey: queryKeys.notifications.lists() },
        (data) => markInCache(data, () => true, now),
      );
      queryClient.setQueryData(queryKeys.notifications.unreadCount(), 0);
      return { lists, count };
    },
    onError: (_error, _variables, context) => {
      context?.lists.forEach(([key, data]) => queryClient.setQueryData(key, data));
      if (context?.count !== undefined) {
        queryClient.setQueryData(queryKeys.notifications.unreadCount(), context.count);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() }),
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.notifications.preferences(),
    queryFn: ({ signal }) => notificationsService.getPreferences(signal),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: NotificationPreferences) =>
      notificationsService.updatePreferences(preferences),
    onSuccess: (preferences) =>
      queryClient.setQueryData(queryKeys.notifications.preferences(), preferences),
  });
}
