import type { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('reports ok with latencies when PostgreSQL and Redis respond', async () => {
    const service = new HealthService(
      { ping: vi.fn(() => Promise.resolve()) } as unknown as PrismaService,
      { ping: vi.fn(() => Promise.resolve('PONG')) } as unknown as Redis,
    );
    const report = await service.check();
    expect(report.status).toBe('ok');
    expect(report.checks.database).toEqual({ status: 'up', latencyMs: expect.any(Number) });
    expect(report.checks.redis.status).toBe('up');
  });

  it('reports an outage without exposing internal addresses or driver messages', async () => {
    const service = new HealthService(
      {
        ping: vi.fn(() => Promise.reject(new Error('connect ECONNREFUSED 10.0.3.7:5432'))),
      } as unknown as PrismaService,
      { ping: vi.fn(() => Promise.resolve('PONG')) } as unknown as Redis,
    );
    const report = await service.check();
    expect(report.status).toBe('error');
    expect(report.checks.database).toEqual({ status: 'down' });
    expect(JSON.stringify(report)).not.toContain('10.0.3.7');
  });
});
