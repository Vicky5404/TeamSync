import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';

import { flattenValidationErrors } from '../common/pipes/validation.pipe.js';
import { NotificationType } from '../generated/prisma/enums.js';
import { renderEmail } from '../infrastructure/mail/email-templates.js';
import type { QueueService } from '../infrastructure/queue/queue.service.js';
import { RedisThrottlerStorage } from '../infrastructure/redis/redis-throttler.storage.js';
import type { PrismaService } from '../infrastructure/prisma/prisma.service.js';

import { extractMentionedEmails } from './comments/mentions.js';
import { resolvePreferences } from './notifications/notification-preferences.service.js';
import { NotificationsService } from './notifications/notifications.service.js';
import { parseClientMessage } from './realtime/ws-message-parser.js';
import { OrganizationTaskQueryDto } from './tasks/dto/task.dto.js';
import { buildTaskWhere } from './tasks/task-filters.js';

describe('task filters', () => {
  const now = new Date('2026-09-23T12:00:00.000Z');

  it('parses repeated and comma-separated query arrays and validates them', async () => {
    const dto = plainToInstance(OrganizationTaskQueryDto, {
      status: ['TODO', 'DONE'],
      priority: 'HIGH,URGENT',
      assignee: 'me',
      page: '2',
      search: '  ',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({
      status: ['TODO', 'DONE'],
      priority: ['HIGH', 'URGENT'],
      assignee: ['me'],
      page: 2,
      search: undefined,
    });
    const invalid = plainToInstance(OrganizationTaskQueryDto, {
      status: 'NOPE',
      assignee: 'robert',
    });
    expect(Object.keys(flattenValidationErrors(await validate(invalid)))).toEqual([
      'status',
      'assignee',
    ]);
  });

  it('builds identifier search, assignee and due-date clauses', () => {
    const where = buildTaskWhere(
      { search: 'web-42', assignee: ['me', 'unassigned'], due: 'overdue' },
      'user-1',
      now,
    );
    expect(where).toEqual({
      AND: [
        {
          OR: [
            { title: { contains: 'web-42', mode: 'insensitive' } },
            { description: { contains: 'web-42', mode: 'insensitive' } },
            { number: 42, project: { key: 'WEB' } },
          ],
        },
        { OR: [{ assigneeId: 'user-1' }, { assigneeId: null }] },
        { status: { not: 'DONE' }, dueDate: { lt: new Date('2026-09-23T00:00:00.000Z') } },
      ],
    });
    expect(buildTaskWhere({}, 'user-1')).toEqual({});
  });
});

describe('mentions', () => {
  it('extracts @email mentions', () => {
    expect(
      extractMentionedEmails('Hi @Priya.Sharma@acme.dev, and (@sam@example.com). Not an@email.com'),
    ).toEqual(['priya.sharma@acme.dev', 'sam@example.com']);
  });
});

describe('NotificationsService.notify', () => {
  it('drops self-notifications and duplicates before enqueueing', async () => {
    const queue = { deliverNotifications: vi.fn() };
    const service = new NotificationsService({} as PrismaService, queue as unknown as QueueService);
    const base = {
      type: NotificationType.TASK_ASSIGNED,
      title: 't',
      body: null,
      organizationId: 'o',
      resource: { type: 'task' as const, id: 't1' },
    };
    await service.notify([
      { ...base, userId: 'actor', actorId: 'actor' },
      { ...base, userId: 'u2', actorId: 'actor' },
      { ...base, userId: 'u2', actorId: 'actor' },
    ]);
    expect(queue.deliverNotifications).toHaveBeenCalledWith([
      { ...base, userId: 'u2', actorId: 'actor' },
    ]);
  });

  it('merges stored preferences over defaults', () => {
    const preferences = resolvePreferences({
      channels: { MENTIONED: { inApp: false, email: false } },
      emailDigest: 'daily',
    });
    expect(preferences.channels.MENTIONED).toEqual({ inApp: false, email: false });
    expect(preferences.channels.TASK_ASSIGNED).toEqual({ inApp: true, email: true });
    expect(preferences.emailDigest).toBe('daily');
    expect(resolvePreferences('garbage').emailDigest).toBe('weekly');
  });
});

describe('WebSocket message parser', () => {
  it('maps { type } messages to Nest events and ignores anything else', () => {
    expect(parseClientMessage('{"type":"subscribe","channel":"organization:1"}')).toEqual({
      event: 'subscribe',
      data: { type: 'subscribe', channel: 'organization:1' },
    });
    expect(parseClientMessage(Buffer.from('{"type":"ping"}'))).toMatchObject({ event: 'ping' });
    expect(parseClientMessage('not json')).toBeUndefined();
    expect(parseClientMessage('[1,2]')).toBeUndefined();
    expect(parseClientMessage('{"event":"auth"}')).toBeUndefined();
  });
});

describe('RedisThrottlerStorage', () => {
  it('converts the Lua result to throttler records', async () => {
    const redis = { eval: vi.fn().mockResolvedValue([11, 30_000, 1, 60_000]) };
    const storage = new RedisThrottlerStorage(redis as unknown as Redis);
    await expect(storage.increment('ip:1', 60_000, 10, 60_000, 'default')).resolves.toEqual({
      totalHits: 11,
      timeToExpire: 30,
      isBlocked: true,
      timeToBlockExpire: 60,
    });
  });

  it('fails open when Redis is unavailable', async () => {
    const redis = { eval: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) };
    const storage = new RedisThrottlerStorage(redis as unknown as Redis);
    await expect(storage.increment('ip:1', 60_000, 10, 0, 'default')).resolves.toMatchObject({
      isBlocked: false,
    });
  });
});

describe('email templates', () => {
  it('escapes interpolated values in HTML', () => {
    const email = renderEmail({
      template: 'invitation',
      data: {
        organizationName: '<script>x</script>',
        inviterName: 'Eve',
        role: 'MEMBER',
        message: '"hi"',
        link: 'https://app/accept?token=a&b',
      },
    });
    expect(email.html).not.toContain('<script>x</script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).toContain('token=a&amp;b');
    expect(email.text).toContain('https://app/accept?token=a&b');
  });
});
