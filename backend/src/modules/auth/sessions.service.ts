import { Injectable, Logger } from '@nestjs/common';

import { Errors } from '../../common/errors/api-exception.js';
import { generateToken, sha256 } from '../../common/utils/crypto.js';
import { parseUserAgent } from '../../common/utils/user-agent.js';
import { AppConfig } from '../../config/app-config.js';
import type { Prisma, Session } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

import type { UserSessionDto } from './dto/auth.dto.js';
import { TokenService } from './token.service.js';

/** A rotated-out refresh token is still honoured briefly (parallel tabs refreshing at once). */
const ROTATION_GRACE_MS = 60_000;

export interface ClientContext {
  ipAddress: string | undefined;
  userAgent: string | undefined;
}

export interface IssuedSession {
  session: Session;
  /** Raw refresh token — goes into the httpOnly cookie and is never stored. */
  refreshToken: string;
}

/**
 * Device sessions backed by opaque, rotating refresh tokens. Only SHA-256
 * hashes are persisted. Presenting an already-rotated token outside the grace
 * window is treated as token theft and revokes the whole session.
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly config: AppConfig,
  ) {}

  ttlMs(rememberMe: boolean): number {
    return rememberMe ? this.config.auth.refreshTtlLongMs : this.config.auth.refreshTtlShortMs;
  }

  async create(userId: string, rememberMe: boolean, client: ClientContext): Promise<IssuedSession> {
    const refreshToken = generateToken();
    const now = new Date();
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: sha256(refreshToken),
        rememberMe,
        userAgent: client.userAgent?.slice(0, 512) ?? null,
        ipAddress: client.ipAddress?.slice(0, 64) ?? null,
        ...parseUserAgent(client.userAgent),
        lastActiveAt: now,
        expiresAt: new Date(now.getTime() + this.ttlMs(rememberMe)),
      },
    });
    return { session, refreshToken };
  }

  /** Exchange a refresh token for a new one (sliding expiry). Throws 401 when invalid. */
  async rotate(presentedToken: string, client: ClientContext, attempt = 0): Promise<IssuedSession> {
    const presentedHash = sha256(presentedToken);
    const session = await this.prisma.session.findFirst({
      where: { OR: [{ refreshTokenHash: presentedHash }, { previousTokenHash: presentedHash }] },
    });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now) {
      throw Errors.unauthorized('No active session.');
    }

    if (session.refreshTokenHash !== presentedHash) {
      const withinGrace =
        session.rotatedAt !== null &&
        now.getTime() - session.rotatedAt.getTime() <= ROTATION_GRACE_MS;
      if (!withinGrace) {
        this.logger.warn(
          { sessionId: session.id, userId: session.userId },
          'Refresh token reuse detected; revoking session',
        );
        await this.revokeWhere({ id: session.id });
        throw Errors.unauthorized('No active session.');
      }
    }

    const refreshToken = generateToken();
    // Compare-and-swap on the current hash so concurrent rotations can't both win.
    const { count } = await this.prisma.session.updateMany({
      where: { id: session.id, refreshTokenHash: session.refreshTokenHash, revokedAt: null },
      data: {
        previousTokenHash: session.refreshTokenHash,
        refreshTokenHash: sha256(refreshToken),
        rotatedAt: now,
        lastActiveAt: now,
        expiresAt: new Date(now.getTime() + this.ttlMs(session.rememberMe)),
        ...(client.ipAddress ? { ipAddress: client.ipAddress.slice(0, 64) } : {}),
      },
    });
    if (count === 0) {
      if (attempt < 2) return this.rotate(presentedToken, client, attempt + 1);
      throw Errors.unauthorized('No active session.');
    }
    const updated = await this.prisma.session.findUniqueOrThrow({ where: { id: session.id } });
    return { session: updated, refreshToken };
  }

  /** Revoke the session a refresh token belongs to (logout). Returns its id, if any. */
  async revokeByToken(presentedToken: string): Promise<string | null> {
    const presentedHash = sha256(presentedToken);
    const session = await this.prisma.session.findFirst({
      where: {
        OR: [{ refreshTokenHash: presentedHash }, { previousTokenHash: presentedHash }],
        revokedAt: null,
      },
      select: { id: true },
    });
    if (!session) return null;
    await this.revokeWhere({ id: session.id });
    return session.id;
  }

  async list(userId: string, currentSessionId: string): Promise<UserSessionDto[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: 'desc' },
      take: 100,
    });
    return sessions
      .map((session) => ({
        id: session.id,
        device: session.device,
        browser: session.browser,
        os: session.os,
        ipAddress: session.ipAddress ?? 'Unknown',
        location: session.location,
        lastActiveAt: session.lastActiveAt.toISOString(),
        createdAt: session.createdAt.toISOString(),
        current: session.id === currentSessionId,
      }))
      .sort((a, b) => Number(b.current) - Number(a.current));
  }

  async revoke(userId: string, sessionId: string): Promise<void> {
    await this.revokeWhere({ id: sessionId, userId });
  }

  async revokeOthers(userId: string, currentSessionId: string): Promise<void> {
    await this.revokeWhere({ userId, id: { not: currentSessionId } });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.revokeWhere({ userId });
  }

  private async revokeWhere(where: Prisma.SessionWhereInput): Promise<void> {
    const sessions = await this.prisma.session.findMany({
      where: { ...where, revokedAt: null },
      select: { id: true },
    });
    if (sessions.length === 0) return;
    const ids = sessions.map((session) => session.id);
    await this.prisma.session.updateMany({
      where: { id: { in: ids } },
      data: { revokedAt: new Date() },
    });
    await this.tokens.revokeSessions(ids);
  }
}
