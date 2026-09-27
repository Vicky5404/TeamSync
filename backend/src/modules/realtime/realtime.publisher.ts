import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { AppConfig } from '../../config/app-config.js';
import { REALTIME_CHANNEL, REDIS_CLIENT } from '../../infrastructure/redis/redis.constants.js';

import { Channels, type RealtimeEventType, type RealtimeMessage } from './realtime.events.js';

/**
 * Publishes real-time events through Redis pub/sub so every API instance
 * (and events raised by background workers) reaches every connected client.
 * Publishing is fire-and-forget: the change has already been committed.
 */
@Injectable()
export class RealtimePublisher {
  private readonly logger = new Logger(RealtimePublisher.name);
  private localDispatcher: ((message: RealtimeMessage) => void) | undefined;
  readonly channel: string;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    config: AppConfig,
  ) {
    // Pub/sub channel names are not covered by ioredis' keyPrefix.
    this.channel = `${config.redis.keyPrefix}${REALTIME_CHANNEL}`;
  }

  /** Called by an in-process gateway so events still reach local clients if Redis is down. */
  registerLocalDispatcher(dispatcher: (message: RealtimeMessage) => void): void {
    this.localDispatcher = dispatcher;
  }

  /** Broadcast to one or more channels (each client receives the event once). */
  async publish(type: RealtimeEventType, channels: string[], payload: unknown): Promise<void> {
    await this.send({ kind: 'event', type, channels: Array.from(new Set(channels)), payload });
  }

  /** Task/comment events go to both the project room and the organization room. */
  async publishToProject(
    type: RealtimeEventType,
    organizationId: string,
    projectId: string,
    payload: unknown,
  ): Promise<void> {
    await this.publish(
      type,
      [Channels.project(projectId), Channels.organization(organizationId)],
      payload,
    );
  }

  async publishToUser(type: RealtimeEventType, userId: string, payload: unknown): Promise<void> {
    await this.publish(type, [Channels.user(userId)], payload);
  }

  async revokeOrganizationAccess(userId: string, organizationId: string): Promise<void> {
    await this.send({ kind: 'revoke', userId, organizationId });
  }

  /** Disconnect every socket (on any API instance) authenticated with these sessions. */
  async revokeSessions(sessionIds: string[]): Promise<void> {
    if (sessionIds.length > 0) await this.send({ kind: 'revoke-sessions', sessionIds });
  }

  private async send(message: RealtimeMessage): Promise<void> {
    try {
      await this.redis.publish(this.channel, JSON.stringify(message));
    } catch (error) {
      this.logger.warn(
        `Realtime publish via Redis failed (${error instanceof Error ? error.message : String(error)}); delivering locally only`,
      );
      this.localDispatcher?.(message);
    }
  }
}
