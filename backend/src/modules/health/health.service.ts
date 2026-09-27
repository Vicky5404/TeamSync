import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.constants.js';

const CHECK_TIMEOUT_MS = 2_000;

export interface DependencyCheck {
  status: 'up' | 'down';
  latencyMs?: number;
}

export interface HealthReport {
  status: 'ok' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  checks: { api: DependencyCheck; database: DependencyCheck; redis: DependencyCheck };
}

const logger = new Logger('HealthService');

/**
 * Time one dependency check. Failure details (host names, addresses, driver
 * messages) are logged for operators but never returned: the endpoint is public.
 */
async function probe(name: string, check: () => Promise<unknown>): Promise<DependencyCheck> {
  const started = performance.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      check(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${CHECK_TIMEOUT_MS}ms`)),
          CHECK_TIMEOUT_MS,
        );
      }),
    ]);
    return { status: 'up', latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    logger.warn(
      {
        dependency: name,
        reason: error instanceof Error ? error.message.slice(0, 200) : 'unknown',
      },
      'Health check failed',
    );
    return { status: 'down' };
  } finally {
    clearTimeout(timer);
  }
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthReport> {
    const [database, redis] = await Promise.all([
      probe('database', () => this.prisma.ping()),
      probe('redis', () => this.redis.ping()),
    ]);
    return {
      status: database.status === 'up' && redis.status === 'up' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks: { api: { status: 'up' }, database, redis },
    };
  }
}
