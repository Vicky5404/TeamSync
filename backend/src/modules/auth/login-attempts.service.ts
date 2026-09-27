import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { sha256 } from '../../common/utils/crypto.js';
import { AppConfig } from '../../config/app-config.js';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.constants.js';

/**
 * Per-account brute-force protection (complements per-IP rate limiting):
 * after N consecutive failures the account is locked for a cooldown window.
 * Keys hash the email so raw addresses never sit in Redis.
 */
@Injectable()
export class LoginAttemptsService {
  private readonly logger = new Logger(LoginAttemptsService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: AppConfig,
  ) {}

  /** Seconds until the lock expires, or 0 when not locked. */
  async lockedFor(email: string): Promise<number> {
    try {
      const key = this.key(email);
      const [failures, ttl] = await Promise.all([this.redis.get(key), this.redis.ttl(key)]);
      return Number(failures ?? 0) >= this.config.auth.loginMaxAttempts ? Math.max(ttl, 1) : 0;
    } catch (error) {
      this.warn(error);
      return 0;
    }
  }

  async recordFailure(email: string): Promise<void> {
    try {
      const key = this.key(email);
      const [[, failures]] = (await this.redis
        .multi()
        .incr(key)
        .expire(key, this.config.auth.loginLockoutSeconds)
        .exec()) as [[unknown, number]];
      if (failures === this.config.auth.loginMaxAttempts) {
        this.logger.warn(
          { account: key },
          'Account temporarily locked after repeated failed sign-ins',
        );
      }
    } catch (error) {
      this.warn(error);
    }
  }

  async reset(email: string): Promise<void> {
    try {
      await this.redis.del(this.key(email));
    } catch (error) {
      this.warn(error);
    }
  }

  private key(email: string): string {
    return `login-failures:${sha256(email).slice(0, 32)}`;
  }

  private warn(error: unknown): void {
    this.logger.warn(
      `Login attempt tracking unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
