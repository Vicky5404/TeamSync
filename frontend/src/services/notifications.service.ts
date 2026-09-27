import { http } from '@/lib/http';
import type {
  CursorPage,
  Notification,
  NotificationFilter,
  NotificationPreferences,
} from '@/types';

export interface NotificationListParams {
  filter?: NotificationFilter;
  cursor?: string;
  limit?: number;
}

export const notificationsService = {
  list: async (
    params: NotificationListParams = {},
    signal?: AbortSignal,
  ): Promise<CursorPage<Notification>> =>
    (await http.get<CursorPage<Notification>>('/notifications', { params, signal })).data,

  unreadCount: async (signal?: AbortSignal): Promise<number> =>
    (await http.get<{ count: number }>('/notifications/unread-count', { signal })).data.count,

  markRead: async (notificationId: string): Promise<Notification> =>
    (await http.post<Notification>(`/notifications/${notificationId}/read`)).data,

  markAllRead: async (): Promise<void> => {
    await http.post('/notifications/read-all');
  },

  getPreferences: async (signal?: AbortSignal): Promise<NotificationPreferences> =>
    (await http.get<NotificationPreferences>('/users/me/notification-preferences', { signal }))
      .data,

  updatePreferences: async (input: NotificationPreferences): Promise<NotificationPreferences> =>
    (await http.put<NotificationPreferences>('/users/me/notification-preferences', input)).data,
};
