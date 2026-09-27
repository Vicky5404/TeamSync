import {
  AtSign,
  CalendarClock,
  CircleDot,
  FolderPlus,
  MessageSquare,
  UserPlus,
  UserRoundCheck,
  type LucideIcon,
} from 'lucide-react';

import { paths } from '@/routes/paths';
import type { Notification, NotificationType } from '@/types';

export const NOTIFICATION_TYPE_META: Record<
  NotificationType,
  { label: string; description: string; icon: LucideIcon }
> = {
  TASK_ASSIGNED: {
    label: 'Task assigned',
    description: 'Someone assigns a task to you',
    icon: UserRoundCheck,
  },
  TASK_COMMENTED: {
    label: 'New comments',
    description: 'Someone comments on a task you follow',
    icon: MessageSquare,
  },
  MENTIONED: { label: 'Mentions', description: 'Someone @mentions you', icon: AtSign },
  TASK_DUE_SOON: {
    label: 'Due date reminders',
    description: 'A task assigned to you is due soon',
    icon: CalendarClock,
  },
  TASK_STATUS_CHANGED: {
    label: 'Status changes',
    description: 'A task you follow changes status',
    icon: CircleDot,
  },
  PROJECT_ADDED: {
    label: 'Added to project',
    description: 'You are added to a project',
    icon: FolderPlus,
  },
  MEMBER_JOINED: {
    label: 'New members',
    description: 'Someone joins your organization',
    icon: UserPlus,
  },
};

/** Where clicking a notification should take the user. */
export function notificationHref(notification: Notification): string | null {
  const resource = notification.resource;
  if (!resource) return null;
  if (resource.type === 'task' && resource.projectId) {
    return paths.task(resource.projectId, resource.id);
  }
  if (resource.type === 'project') return paths.project(resource.id);
  if (resource.type === 'organization') return paths.team;
  return null;
}
