import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiException } from '../../common/errors/api-exception.js';
import { sha256 } from '../../common/utils/crypto.js';
import type { AppConfig } from '../../config/app-config.js';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

import { SessionsService } from './sessions.service.js';
import type { TokenService } from './token.service.js';

const config = {
  auth: { refreshTtlLongMs: 30 * 86_400_000, refreshTtlShortMs: 86_400_000 },
} as AppConfig;
const client = { ipAddress: '203.0.113.1', userAgent: 'test' };

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    userId: 'user-1',
    refreshTokenHash: sha256('current-token'),
    previousTokenHash: sha256('previous-token'),
    rotatedAt: new Date(),
    rememberMe: true,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 86_400_000),
    ...overrides,
  };
}

describe('SessionsService.rotate', () => {
  const prisma = {
    session: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
  };
  const tokens = { revokeSessions: vi.fn() };
  let service: SessionsService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new SessionsService(
      prisma as unknown as PrismaService,
      tokens as unknown as TokenService,
      config,
    );
    prisma.session.updateMany.mockResolvedValue({ count: 1 });
    prisma.session.findMany.mockResolvedValue([{ id: 'session-1' }]);
    prisma.session.findUniqueOrThrow.mockImplementation(() => Promise.resolve(session()));
  });

  it('rotates the current token and stores only hashes', async () => {
    prisma.session.findFirst.mockResolvedValue(session());
    const { refreshToken } = await service.rotate('current-token', client);

    expect(refreshToken).not.toBe('current-token');
    const [{ where, data }] = prisma.session.updateMany.mock.calls[0] as [
      { where: Record<string, unknown>; data: Record<string, unknown> },
    ];
    // Compare-and-swap on the old hash; the raw token never reaches the database.
    expect(where).toMatchObject({ id: 'session-1', refreshTokenHash: sha256('current-token') });
    expect(data.refreshTokenHash).toBe(sha256(refreshToken));
    expect(data.previousTokenHash).toBe(sha256('current-token'));
    expect(JSON.stringify(data)).not.toContain(refreshToken);
  });

  it('accepts the previous token within the grace window (parallel tabs)', async () => {
    prisma.session.findFirst.mockResolvedValue(
      session({ rotatedAt: new Date(Date.now() - 5_000) }),
    );
    await expect(service.rotate('previous-token', client)).resolves.toHaveProperty('refreshToken');
    expect(tokens.revokeSessions).not.toHaveBeenCalled();
  });

  it('treats reuse of an old token as theft and revokes the session', async () => {
    prisma.session.findFirst.mockResolvedValue(
      session({ rotatedAt: new Date(Date.now() - 10 * 60_000) }),
    );
    await expect(service.rotate('previous-token', client)).rejects.toBeInstanceOf(ApiException);
    expect(tokens.revokeSessions).toHaveBeenCalledWith(['session-1']);
  });

  it('rejects unknown, revoked and expired sessions', async () => {
    prisma.session.findFirst.mockResolvedValueOnce(null);
    await expect(service.rotate('nope', client)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    prisma.session.findFirst.mockResolvedValueOnce(session({ revokedAt: new Date() }));
    await expect(service.rotate('current-token', client)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    prisma.session.findFirst.mockResolvedValueOnce(
      session({ expiresAt: new Date(Date.now() - 1) }),
    );
    await expect(service.rotate('current-token', client)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('retries when a concurrent rotation wins the compare-and-swap', async () => {
    prisma.session.findFirst.mockResolvedValue(session());
    prisma.session.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    await expect(service.rotate('current-token', client)).resolves.toHaveProperty('refreshToken');
    expect(prisma.session.updateMany).toHaveBeenCalledTimes(2);
  });
});
