import { Injectable } from '@nestjs/common';

import { Errors } from '../../common/errors/api-exception.js';
import {
  afterCursor,
  type CursorPage,
  keysetOrder,
  resolveLimit,
  toCursorPage,
} from '../../common/utils/pagination.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { NotificationIntent } from '../../infrastructure/queue/queue.constants.js';
import { QueueService } from '../../infrastructure/queue/queue.service.js';

import type { NotificationDto } from './dto/notification.dto.js';
import { notificationInclude, toNotificationDto } from './notification.mapper.js';

/**
 * Notification API used by request handlers. `notify` only enqueues: the
 * notifications worker applies preferences, persists, pushes over WebSocket
 * and hands email delivery to the email queue — with retries at each step.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async notify(intents: NotificationIntent[]): Promise<void> {
    const seen = new Set<string>();
    const deliverable = intents.filter((intent) => {
      // Never notify people about their own actions; one notification per user/type/resource.
      if (intent.userId === intent.actorId) return false;
      const key = `${intent.userId}:${intent.type}:${intent.resource?.id ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    await this.queue.deliverNotifications(deliverable);
  }

  async list(
    userId: string,
    query: { filter?: 'all' | 'unread'; cursor?: string; limit?: number },
  ): Promise<CursorPage<NotificationDto>> {
    const limit = resolveLimit(query.limit);
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(query.filter === 'unread' ? { readAt: null } : {}),
        ...afterCursor(query.cursor),
      },
      include: notificationInclude,
      orderBy: keysetOrder,
      take: limit + 1,
    });
    return toCursorPage(rows, limit, toNotificationDto);
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationDto> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    const row = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      include: notificationInclude,
    });
    if (!row) throw Errors.notFound('Notification');
    return toNotificationDto(row);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
