import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';

import { AppConfig } from '../../config/app-config.js';

import { CacheService } from './cache.service.js';
import { REDIS_CLIENT } from './redis.constants.js';

/**
 * Shared Redis connection for caching, rate limiting, pub/sub publishing and
 * short-lived data. Commands fail fast (instead of queueing indefinitely) when
 * Redis is unreachable so callers can degrade gracefully.
 */
export function createRedisClient(config: AppConfig, connectionName: string): Redis {
  const logger = new Logger('Redis');
  const client = new Redis(config.redis.url, {
    connectionName,
    keyPrefix: config.redis.keyPrefix,
    maxRetriesPerRequest: 1,
    commandTimeout: 2_000,
    retryStrategy: (attempt) => Math.min(attempt * 200, 5_000),
  });
  client.on('error', (error: Error) => logger.warn(`[${connectionName}] ${error.message}`));
  client.on('ready', () => logger.log(`[${connectionName}] connected`));
  return client;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => createRedisClient(config, 'flowsync:commands'),
    },
    CacheService,
  ],
  exports: [REDIS_CLIENT, CacheService],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
