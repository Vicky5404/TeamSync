import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Redis } from 'ioredis';

import type { AccessTokenPayload, AuthUser } from '../../common/auth/auth.types.js';
import { Errors } from '../../common/errors/api-exception.js';
import { AppConfig } from '../../config/app-config.js';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.constants.js';
import { RealtimePublisher } from '../realtime/realtime.publisher.js';

export interface IssuedAccessToken {
  accessToken: string;
  /** Lifetime in seconds. */
  expiresIn: number;
}

export interface VerifiedAccessToken {
  user: AuthUser;
  /** When the token stops being valid (epoch milliseconds). */
  expiresAt: number;
}

/**
 * Short-lived JWT access tokens (HS256, issuer/audience bound). Revoked
 * sessions are kept on a Redis denylist for one access-token lifetime so
 * logout, password changes and session revocation take effect immediately —
 * including on open WebSocket connections, which are closed.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly realtime: RealtimePublisher,
  ) {}

  async issueAccessToken(userId: string, sessionId: string): Promise<IssuedAccessToken> {
    const payload: AccessTokenPayload = { sub: userId, sid: sessionId, typ: 'access' };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, expiresIn: this.config.auth.accessTtlSeconds };
  }

  /** Verify a raw access token (used outside HTTP guards, e.g. the WebSocket handshake). */
  async verifyAccessToken(token: string): Promise<VerifiedAccessToken> {
    let payload: AccessTokenPayload & { exp?: number };
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload & { exp?: number }>(token);
    } catch {
      throw Errors.unauthorized();
    }
    const user = await this.validatePayload(payload);
    const expiresAt =
      typeof payload.exp === 'number'
        ? payload.exp * 1000
        : Date.now() + this.config.auth.accessTtlSeconds * 1000;
    return { user, expiresAt };
  }

  /** Shared claim validation for the HTTP strategy and the WebSocket gateway. */
  async validatePayload(payload: Partial<AccessTokenPayload>): Promise<AuthUser> {
    if (
      payload.typ !== 'access' ||
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string'
    ) {
      throw Errors.unauthorized();
    }
    if (await this.isSessionRevoked(payload.sid)) throw Errors.unauthorized();
    return { id: payload.sub, sessionId: payload.sid };
  }

  async revokeSessions(sessionIds: string[]): Promise<void> {
    if (sessionIds.length === 0) return;
    // Open WebSocket connections of these sessions are closed on every API instance.
    await this.realtime.revokeSessions(sessionIds);
    try {
      const pipeline = this.redis.pipeline();
      for (const sessionId of sessionIds) {
        pipeline.set(`revoked-session:${sessionId}`, '1', 'EX', this.config.auth.accessTtlSeconds);
      }
      await pipeline.exec();
    } catch (error) {
      // Revocation still applies to refresh; access tokens expire within minutes.
      this.logger.error({ err: error }, 'Failed to record revoked sessions');
    }
  }

  private async isSessionRevoked(sessionId: string): Promise<boolean> {
    try {
      return (await this.redis.exists(`revoked-session:${sessionId}`)) === 1;
    } catch (error) {
      // Fail open: availability over immediacy; the session's refresh token is revoked in the DB.
      this.logger.warn(
        `Revocation check unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
