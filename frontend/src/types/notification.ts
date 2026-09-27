import type { ISODateTime } from './api';
import type { UserSummary } from './user';

export const NOTIFICATION_TYPES = [
  'TASK_ASSIGNED',
  'TASK_COMMENTED',
  'MENTIONED',
  'TASK_DUE_SOON',
  'TASK_STATUS_CHANGED',
  'PROJECT_ADDED',
  'MEMBER_JOINED',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationResource {
  type: 'task' | 'project' | 'organization';
  id: string;
  projectId?: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  actor: UserSummary | null;
  resource: NotificationResource | null;
  readAt: ISODateTime | null;
  createdAt: ISODateTime;
}

export type NotificationFilter = 'all' | 'unread';

export interface NotificationChannelPreference {
  inApp: boolean;
  email: boolean;
}

export type EmailDigest = 'never' | 'daily' | 'weekly';

export interface NotificationPreferences {
  channels: Record<NotificationType, NotificationChannelPreference>;
  emailDigest: EmailDigest;
}
