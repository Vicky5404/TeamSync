import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { REDIS_CLIENT } from './redis.constants.js';

/**
 * JSON cache on top of Redis. Every operation is best-effort: if Redis is
 * unavailable the cache behaves as a miss, and callers fall back to the database.
 *
 * Only cache data that is safe to serve slightly stale and that every reader of
 * the key is allowed to see (keys must encode the scope). Never cache secrets,
 * tokens or password hashes.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(`cache:${key}`);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch (error) {
      this.warn('get', key, error);
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(`cache:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.warn('set', key, error);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.redis.del(...keys.map((key) => `cache:${key}`));
    } catch (error) {
      this.warn('del', keys.join(','), error);
    }
  }

  /** Read-through helper: return the cached value or load, cache and return it. */
  async wrap<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await load();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Current value of a namespace version counter. Embedding the version in
   * cache keys lets a single `bumpVersion` invalidate a whole family of keys
   * (they simply stop being read and expire on their own).
   */
  async version(namespace: string): Promise<number> {
    try {
      return Number((await this.redis.get(`cache-version:${namespace}`)) ?? 0);
    } catch (error) {
      this.warn('version', namespace, error);
      return -1;
    }
  }

  async bumpVersion(namespace: string): Promise<void> {
    try {
      const key = `cache-version:${namespace}`;
      await this.redis
        .multi()
        .incr(key)
        .expire(key, 7 * 86_400)
        .exec();
    } catch (error) {
      this.warn('bumpVersion', namespace, error);
    }
  }

  private warn(operation: string, key: string, error: unknown): void {
    this.logger.warn(
      `Cache ${operation} failed for "${key}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
