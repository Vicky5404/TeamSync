import { JwtService } from '@nestjs/jwt';
import type { Redis } from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '../../config/app-config.js';
import type { RealtimePublisher } from '../realtime/realtime.publisher.js';

import { TokenService } from './token.service.js';

const SECRET = 'a-sufficiently-long-random-secret-for-tests-123';
const CLAIMS = { issuer: 'flowsync-api', audience: 'flowsync-web' };

describe('TokenService', () => {
  const config = { auth: { accessTtlSeconds: 900, ...CLAIMS } } as AppConfig;
  const jwt = new JwtService({
    secret: SECRET,
    signOptions: { algorithm: 'HS256', expiresIn: 900, ...CLAIMS },
    verifyOptions: { algorithms: ['HS256'], ...CLAIMS },
  });
  const pipeline = { set: vi.fn(), exec: vi.fn() };
  const redis = { exists: vi.fn(), pipeline: vi.fn(() => pipeline) };
  const realtime = { revokeSessions: vi.fn() };
  let tokens: TokenService;

  beforeEach(() => {
    vi.clearAllMocks();
    redis.exists.mockResolvedValue(0);
    tokens = new TokenService(
      jwt,
      config,
      redis as unknown as Redis,
      realtime as unknown as RealtimePublisher,
    );
  });

  it('issues access tokens that verify to the user, session and expiry', async () => {
    const { accessToken, expiresIn } = await tokens.issueAccessToken('user-1', 'session-1');
    expect(expiresIn).toBe(900);

    const verified = await tokens.verifyAccessToken(accessToken);
    expect(verified.user).toEqual({ id: 'user-1', sessionId: 'session-1' });
    expect(verified.expiresAt).toBeGreaterThan(Date.now() + 800_000);
    expect(verified.expiresAt).toBeLessThanOrEqual(Date.now() + 900_000);
  });

  it('rejects tampered, foreign-key and non-access tokens', async () => {
    const { accessToken } = await tokens.issueAccessToken('user-1', 'session-1');
    const [header, , signature] = accessToken.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'admin', sid: 'x', typ: 'access' }),
    ).toString('base64url');
    await expect(
      tokens.verifyAccessToken(`${header}.${forgedPayload}.${signature}`),
    ).rejects.toMatchObject({ status: 401 });

    const other = new JwtService({ secret: 'another-secret-another-secret-another-1' });
    await expect(
      tokens.verifyAccessToken(await other.signAsync({ sub: 'user-1', sid: 's', typ: 'access' })),
    ).rejects.toMatchObject({ status: 401 });

    await expect(
      tokens.verifyAccessToken(await jwt.signAsync({ sub: 'user-1', sid: 's', typ: 'refresh' })),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('rejects tokens of revoked sessions', async () => {
    const { accessToken } = await tokens.issueAccessToken('user-1', 'session-1');
    redis.exists.mockResolvedValue(1);
    await expect(tokens.verifyAccessToken(accessToken)).rejects.toMatchObject({ status: 401 });
  });

  it('revokes sessions for one access-token lifetime and disconnects their sockets', async () => {
    await tokens.revokeSessions(['s1', 's2']);
    expect(pipeline.set).toHaveBeenCalledWith('revoked-session:s1', '1', 'EX', 900);
    expect(pipeline.set).toHaveBeenCalledWith('revoked-session:s2', '1', 'EX', 900);
    expect(realtime.revokeSessions).toHaveBeenCalledWith(['s1', 's2']);
  });
});
