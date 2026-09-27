import { Injectable } from '@nestjs/common';

import { generateToken, sha256 } from '../../common/utils/crypto.js';
import type { Prisma, UserToken } from '../../generated/prisma/client.js';
import { UserTokenType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

const TTL_MS: Record<UserTokenType, number> = {
  [UserTokenType.EMAIL_VERIFICATION]: 24 * 3_600_000,
  [UserTokenType.PASSWORD_RESET]: 3_600_000,
};

/** Single-use, expiring tokens for email verification and password reset (stored hashed). */
@Injectable()
export class UserTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /** Issue a new token, invalidating any outstanding token of the same type. */
  async issue(userId: string, type: UserTokenType): Promise<string> {
    const token = generateToken();
    await this.prisma.$transaction([
      this.prisma.userToken.updateMany({
        where: { userId, type, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.userToken.create({
        data: {
          userId,
          type,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + TTL_MS[type]),
        },
      }),
    ]);
    return token;
  }

  /**
   * Atomically consume a valid token inside the caller's transaction.
   * Returns null for unknown, expired or already-used tokens.
   */
  async consume(
    token: string,
    type: UserTokenType,
    tx: Prisma.TransactionClient,
  ): Promise<UserToken | null> {
    const record = await tx.userToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.type !== type || record.consumedAt || record.expiresAt <= new Date())
      return null;
    const { count } = await tx.userToken.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return count === 1 ? record : null;
  }
}
