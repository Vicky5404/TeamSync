import { ApiProperty } from '@nestjs/swagger';

import type { Prisma } from '../../generated/prisma/client.js';

/** Compact user representation embedded in other resources. */
export class UserSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Alex Morgan' })
  name: string;

  @ApiProperty({ example: 'alex@example.com' })
  email: string;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl: string | null;
}

export const userSummarySelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
} as const satisfies Prisma.UserSelect;

export type UserSummaryRow = Prisma.UserGetPayload<{ select: typeof userSummarySelect }>;

/** Users referenced by deleted accounts (SET NULL foreign keys) render as "Deleted user". */
export function toUserSummary(user: UserSummaryRow | null, fallbackId = ''): UserSummaryDto {
  return user
    ? { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl }
    : { id: fallbackId, name: 'Deleted user', email: '', avatarUrl: null };
}
