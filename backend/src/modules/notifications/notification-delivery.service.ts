import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { addDays, startOfTodayUTC, toISODate } from '../../common/utils/dates.js';
import { AppConfig } from '../../config/app-config.js';
import { NotificationType, TaskStatus } from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { NotificationIntent } from '../../infrastructure/queue/queue.constants.js';
import { QueueService } from '../../infrastructure/queue/queue.service.js';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.constants.js';
import { RealtimeEvent } from '../realtime/realtime.events.js';
import { RealtimePublisher } from '../realtime/realtime.publisher.js';

import { NotificationPreferencesService } from './notification-preferences.service.js';
import { notificationInclude, notificationPath, toNotificationDto } from './notification.mapper.js';

const DUE_SOON_BATCH = 500;

export interface DeliveryResult {
  persisted: number;
  emailed: number;
  skipped: number;
}

/**
 * Worker-side delivery: applies each recipient's channel preferences, persists
 * in-app notifications in one statement, pushes them over WebSocket and
 * enqueues emails. Persistence is the only step that can throw, so a retried
 * job never creates duplicates.
 */
@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly preferences: NotificationPreferencesService,
    private readonly realtime: RealtimePublisher,
    private readonly queue: QueueService,
    private readonly config: AppConfig,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async deliver(intents: NotificationIntent[]): Promise<DeliveryResult> {
    if (intents.length === 0) return { persisted: 0, emailed: 0, skipped: 0 };
    const recipients = await this.preferences.forUsers([
      ...new Set(intents.map((intent) => intent.userId)),
    ]);

    const inApp: NotificationIntent[] = [];
    const email: Array<{ intent: NotificationIntent; to: string }> = [];
    let skipped = 0;
    for (const intent of intents) {
      const recipient = recipients.get(intent.userId);
      if (!recipient) {
        skipped += 1;
        continue;
      }
      const channel = recipient.preferences.channels[intent.type];
      if (channel.inApp) inApp.push(intent);
      if (channel.email) email.push({ intent, to: recipient.email });
      if (!channel.inApp && !channel.email) skipped += 1;
    }

    if (inApp.length > 0) {
      const created = await this.prisma.notification.createManyAndReturn({
        data: inApp.map((intent) => ({
          userId: intent.userId,
          organizationId: intent.organizationId,
          actorId: intent.actorId,
          type: intent.type,
          title: intent.title.slice(0, 200),
          body: intent.body?.slice(0, 500) ?? null,
          resource: (intent.resource ?? undefined) as Prisma.InputJsonObject | undefined,
        })),
        select: { id: true },
      });
      const rows = await this.prisma.notification.findMany({
        where: { id: { in: created.map((row) => row.id) } },
        include: notificationInclude,
      });
      for (const row of rows) {
        void this.realtime.publishToUser(
          RealtimeEvent.NOTIFICATION_CREATED,
          row.userId,
          toNotificationDto(row),
        );
      }
    }

    for (const { intent, to } of email) {
      const path = notificationPath(intent.resource);
      await this.queue.sendEmail({
        to,
        template: 'notification',
        data: {
          title: intent.title,
          body: intent.body,
          link: path ? this.config.appLink(path) : null,
        },
      });
    }

    return { persisted: inApp.length, emailed: email.length, skipped };
  }

  /**
   * Remind assignees about open tasks due today or tomorrow. A Redis marker per
   * task and due date guarantees at most one reminder even though the scan
   * runs repeatedly (and survives due-date changes correctly).
   */
  async scanDueSoon(now = new Date()): Promise<number> {
    const today = startOfTodayUTC(now);
    const tomorrow = addDays(today, 1);
    let cursor: string | undefined;
    let sent = 0;

    for (;;) {
      const tasks = await this.prisma.task.findMany({
        // Served by the partial `tasks_due_soon_idx` index.
        where: {
          deletedAt: null,
          status: { not: TaskStatus.DONE },
          assigneeId: { not: null },
          dueDate: { gte: today, lte: tomorrow },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        select: {
          id: true,
          title: true,
          number: true,
          dueDate: true,
          assigneeId: true,
          projectId: true,
          organizationId: true,
          project: { select: { key: true } },
        },
        orderBy: { id: 'asc' },
        take: DUE_SOON_BATCH,
      });
      if (tasks.length === 0) break;
      cursor = tasks.at(-1)?.id;

      const intents: NotificationIntent[] = [];
      for (const task of tasks) {
        if (!task.assigneeId || !task.dueDate) continue;
        const dueDate = toISODate(task.dueDate);
        const marked = await this.redis
          .set(`due-soon:${task.id}:${dueDate}`, '1', 'EX', 3 * 86_400, 'NX')
          .catch(() => null);
        if (marked !== 'OK') continue;
        const when = dueDate === toISODate(today) ? 'today' : 'tomorrow';
        intents.push({
          userId: task.assigneeId,
          type: NotificationType.TASK_DUE_SOON,
          title: `${task.project.key}-${task.number} is due ${when}`,
          body: task.title,
          actorId: null,
          organizationId: task.organizationId,
          resource: { type: 'task', id: task.id, projectId: task.projectId },
        });
      }
      const result = await this.deliver(intents);
      sent += intents.length;
      if (result.skipped > 0)
        this.logger.debug(`Skipped ${result.skipped} due-date reminder(s) by preference`);
      if (tasks.length < DUE_SOON_BATCH) break;
    }
    return sent;
  }
}
