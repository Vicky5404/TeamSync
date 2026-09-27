import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Fixed-window counter with optional blocking, executed atomically in Redis so
 * limits hold across every API instance.
 * Returns: { hits, windowTtlMs, blocked (0/1), blockTtlMs }.
 */
const INCREMENT_SCRIPT = `
local hitsKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local blockTtl = redis.call('PTTL', blockKey)
if blockTtl > 0 then
  local hits = tonumber(redis.call('GET', hitsKey) or limit + 1)
  return { hits, math.max(redis.call('PTTL', hitsKey), 0), 1, blockTtl }
end

local hits = redis.call('INCR', hitsKey)
local windowTtl = redis.call('PTTL', hitsKey)
if windowTtl < 0 then
  redis.call('PEXPIRE', hitsKey, ttl)
  windowTtl = ttl
end

if hits > limit then
  redis.call('SET', blockKey, '1', 'PX', blockDuration)
  return { hits, windowTtl, 1, blockDuration }
end
return { hits, windowTtl, 0, 0 }
`;

/** Redis-backed `ThrottlerStorage`. Fails open (logs) if Redis is unavailable. */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitsKey = `throttle:${throttlerName}:${key}`;
    try {
      const [hits, windowTtl, blocked, blockTtl] = (await this.redis.eval(
        INCREMENT_SCRIPT,
        2,
        hitsKey,
        `${hitsKey}:blocked`,
        ttl,
        limit,
        blockDuration > 0 ? blockDuration : ttl,
      )) as [number, number, number, number];
      return {
        totalHits: hits,
        timeToExpire: Math.ceil(windowTtl / 1000),
        isBlocked: blocked === 1,
        timeToBlockExpire: Math.ceil(blockTtl / 1000),
      };
    } catch (error) {
      this.logger.warn(
        `Rate limiter unavailable, allowing request: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        totalHits: 0,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
