import { toUserSummary, userSummarySelect } from '../../common/dto/user-summary.dto.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { NotificationResource } from '../../infrastructure/queue/queue.constants.js';

import type { NotificationDto } from './dto/notification.dto.js';

export const notificationInclude = {
  actor: { select: userSummarySelect },
} as const satisfies Prisma.NotificationInclude;

export type NotificationRow = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

export function toNotificationDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    actor: row.actorId ? toUserSummary(row.actor, row.actorId) : null,
    resource: (row.resource as NotificationResource | null) ?? null,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Web-client path a notification links to (mirrors `notificationHref` in the web client). */
export function notificationPath(resource: NotificationResource | null): string | null {
  if (!resource) return null;
  if (resource.type === 'task' && resource.projectId) {
    return `/projects/${resource.projectId}/board?task=${resource.id}`;
  }
  if (resource.type === 'project') return `/projects/${resource.id}`;
  if (resource.type === 'organization') return '/team';
  return null;
}
