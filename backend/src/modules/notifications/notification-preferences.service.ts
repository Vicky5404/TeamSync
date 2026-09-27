import { Injectable } from '@nestjs/common';

import { Errors } from '../../common/errors/api-exception.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { NotificationType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

import {
  EMAIL_DIGESTS,
  type EmailDigest,
  type NotificationPreferencesDto,
} from './dto/notification.dto.js';

export interface NotificationPreferences {
  channels: Record<NotificationType, { inApp: boolean; email: boolean }>;
  emailDigest: EmailDigest;
}

const EMAIL_BY_DEFAULT: NotificationType[] = [
  NotificationType.TASK_ASSIGNED,
  NotificationType.MENTIONED,
  NotificationType.TASK_DUE_SOON,
];

export function defaultPreferences(): NotificationPreferences {
  return {
    channels: Object.fromEntries(
      Object.values(NotificationType).map((type) => [
        type,
        { inApp: true, email: EMAIL_BY_DEFAULT.includes(type) },
      ]),
    ) as NotificationPreferences['channels'],
    emailDigest: 'weekly',
  };
}

/** Merge stored preferences over the defaults (tolerates new types added later). */
export function resolvePreferences(stored: unknown): NotificationPreferences {
  const defaults = defaultPreferences();
  if (typeof stored !== 'object' || stored === null) return defaults;
  const value = stored as Partial<NotificationPreferences>;
  const channels = { ...defaults.channels };
  for (const type of Object.values(NotificationType)) {
    const channel = value.channels?.[type];
    if (channel && typeof channel.inApp === 'boolean' && typeof channel.email === 'boolean') {
      channels[type] = { inApp: channel.inApp, email: channel.email };
    }
  }
  const emailDigest = EMAIL_DIGESTS.includes(value.emailDigest as EmailDigest)
    ? (value.emailDigest as EmailDigest)
    : defaults.emailDigest;
  return { channels, emailDigest };
}

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<NotificationPreferences> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    });
    if (!user) throw Errors.notFound('User');
    return resolvePreferences(user.notificationPreferences);
  }

  async update(
    userId: string,
    input: NotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    const preferences = resolvePreferences(input);
    await this.prisma.user.update({
      where: { id: userId },
      data: { notificationPreferences: preferences as unknown as Prisma.InputJsonObject },
    });
    return preferences;
  }

  async forUsers(
    userIds: string[],
  ): Promise<Map<string, { email: string; preferences: NotificationPreferences }>> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, deletedAt: null },
      select: { id: true, email: true, notificationPreferences: true },
    });
    return new Map(
      users.map((user) => [
        user.id,
        { email: user.email, preferences: resolvePreferences(user.notificationPreferences) },
      ]),
    );
  }
}
