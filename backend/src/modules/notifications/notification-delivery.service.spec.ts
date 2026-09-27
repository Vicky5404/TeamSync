import type { Redis } from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '../../config/app-config.js';
import { NotificationType } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { NotificationIntent } from '../../infrastructure/queue/queue.constants.js';
import type { QueueService } from '../../infrastructure/queue/queue.service.js';
import { RealtimeEvent } from '../realtime/realtime.events.js';
import type { RealtimePublisher } from '../realtime/realtime.publisher.js';

import { NotificationDeliveryService } from './notification-delivery.service.js';
import {
  defaultPreferences,
  type NotificationPreferencesService,
} from './notification-preferences.service.js';

const intent = (overrides: Partial<NotificationIntent> = {}): NotificationIntent => ({
  userId: 'user-1',
  type: NotificationType.TASK_ASSIGNED,
  title: 'You were assigned WEB-7',
  body: 'Fix login',
  actorId: 'user-2',
  organizationId: 'org-1',
  resource: { type: 'task', id: 'task-1', projectId: 'project-1' },
  ...overrides,
});

describe('NotificationDeliveryService.deliver', () => {
  const prisma = {
    notification: { createManyAndReturn: vi.fn(), findMany: vi.fn() },
  };
  const preferences = { forUsers: vi.fn() };
  const realtime = { publishToUser: vi.fn() };
  const queue = { sendEmail: vi.fn() };
  const config = {
    appLink: (path: string) => `https://app.example.com${path}`,
  } as unknown as AppConfig;
  let service: NotificationDeliveryService;

  beforeEach(() => {
    vi.resetAllMocks();
    realtime.publishToUser.mockResolvedValue(undefined);
    prisma.notification.createManyAndReturn.mockImplementation(({ data }: { data: unknown[] }) =>
      Promise.resolve(data.map((_, index) => ({ id: `n${index}` }))),
    );
    prisma.notification.findMany.mockImplementation(
      ({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(
          where.id.in.map((id) => ({
            id,
            userId: 'user-1',
            organizationId: 'org-1',
            actorId: 'user-2',
            type: NotificationType.TASK_ASSIGNED,
            title: 'You were assigned WEB-7',
            body: 'Fix login',
            resource: { type: 'task', id: 'task-1', projectId: 'project-1' },
            readAt: null,
            createdAt: new Date(),
            actor: { id: 'user-2', name: 'Sam', email: 'sam@x.dev', avatarUrl: null },
          })),
        ),
    );
    service = new NotificationDeliveryService(
      prisma as unknown as PrismaService,
      preferences as unknown as NotificationPreferencesService,
      realtime as unknown as RealtimePublisher,
      queue as unknown as QueueService,
      config,
      {} as Redis,
    );
  });

  it('persists in-app notifications, pushes them live and emails per preferences', async () => {
    preferences.forUsers.mockResolvedValue(
      new Map([['user-1', { email: 'alex@x.dev', preferences: defaultPreferences() }]]),
    );

    const result = await service.deliver([intent()]);

    expect(result).toEqual({ persisted: 1, emailed: 1, skipped: 0 });
    expect(prisma.notification.createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            userId: 'user-1',
            organizationId: 'org-1',
            type: NotificationType.TASK_ASSIGNED,
            title: 'You were assigned WEB-7',
          }),
        ],
      }),
    );
    expect(realtime.publishToUser).toHaveBeenCalledWith(
      RealtimeEvent.NOTIFICATION_CREATED,
      'user-1',
      expect.objectContaining({ id: 'n0' }),
    );
    expect(queue.sendEmail).toHaveBeenCalledWith({
      to: 'alex@x.dev',
      template: 'notification',
      data: expect.objectContaining({
        title: 'You were assigned WEB-7',
        link: expect.stringContaining('https://app.example.com/projects/project-1'),
      }),
    });
  });

  it('respects opt-outs and skips recipients that no longer exist', async () => {
    const quiet = defaultPreferences();
    quiet.channels.TASK_ASSIGNED = { inApp: false, email: false };
    preferences.forUsers.mockResolvedValue(
      new Map([['user-1', { email: 'alex@x.dev', preferences: quiet }]]),
    );

    const result = await service.deliver([intent(), intent({ userId: 'deleted-user' })]);

    expect(result).toEqual({ persisted: 0, emailed: 0, skipped: 2 });
    expect(prisma.notification.createManyAndReturn).not.toHaveBeenCalled();
    expect(queue.sendEmail).not.toHaveBeenCalled();
  });

  it('caps stored text to the column sizes', async () => {
    preferences.forUsers.mockResolvedValue(
      new Map([['user-1', { email: 'alex@x.dev', preferences: defaultPreferences() }]]),
    );
    await service.deliver([intent({ title: 'x'.repeat(500), body: 'y'.repeat(2000) })]);
    const [row] = (
      prisma.notification.createManyAndReturn.mock.calls[0]?.[0] as {
        data: Array<{ title: string; body: string }>;
      }
    ).data;
    expect(row?.title).toHaveLength(200);
    expect(row?.body).toHaveLength(500);
  });

  it('does nothing for an empty batch', async () => {
    await expect(service.deliver([])).resolves.toEqual({ persisted: 0, emailed: 0, skipped: 0 });
    expect(preferences.forUsers).not.toHaveBeenCalled();
  });
});
