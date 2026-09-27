import type { InfiniteData } from '@tanstack/react-query';

import type { RealtimeRegistration } from '@/lib/realtime/RealtimeProvider';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/store/toast.store';
import type { CursorPage, Notification } from '@/types';

type NotificationPages = InfiniteData<CursorPage<Notification>, string | null>;

/**
 * Push new notifications straight into the cache: prepend to the loaded lists,
 * bump the unread badge and surface a toast.
 */
export const registerNotificationRealtime: RealtimeRegistration = (client, queryClient) =>
  client.on('notification.created', (notification) => {
    const prepend = (data: NotificationPages | undefined): NotificationPages | undefined => {
      const [first, ...rest] = data?.pages ?? [];
      if (!data || !first) return data;
      if (first.data.some((item) => item.id === notification.id)) return data;
      return { ...data, pages: [{ ...first, data: [notification, ...first.data] }, ...rest] };
    };

    queryClient.setQueryData<NotificationPages>(queryKeys.notifications.list('all'), prepend);
    queryClient.setQueryData<NotificationPages>(queryKeys.notifications.list('unread'), prepend);
    queryClient.setQueryData<number>(queryKeys.notifications.unreadCount(), (count) =>
      count === undefined ? count : count + 1,
    );

    toast.info(notification.title, { description: notification.body ?? undefined });
  });
