import { toUserSummary, userSummarySelect } from '../../common/dto/user-summary.dto.js';
import type { Organization, Prisma } from '../../generated/prisma/client.js';
import type { Role } from '../../generated/prisma/enums.js';

import type { InvitationDto, MemberDto, OrganizationDto } from './dto/organization.dto.js';

export const memberInclude = {
  user: {
    select: { id: true, name: true, email: true, avatarUrl: true, jobTitle: true, timezone: true },
  },
} as const satisfies Prisma.MembershipInclude;

export type MemberRow = Prisma.MembershipGetPayload<{ include: typeof memberInclude }>;

export const invitationInclude = {
  invitedBy: { select: userSummarySelect },
} as const satisfies Prisma.InvitationInclude;

export type InvitationRow = Prisma.InvitationGetPayload<{ include: typeof invitationInclude }>;

export function toOrganizationDto(
  organization: Organization,
  role: Role,
  memberCount: number,
): OrganizationDto {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    description: organization.description,
    logoUrl: organization.logoUrl,
    memberCount,
    createdAt: organization.createdAt.toISOString(),
    role,
  };
}

export function toMemberDto(row: MemberRow): MemberDto {
  return {
    id: row.id,
    role: row.role,
    joinedAt: row.joinedAt.toISOString(),
    lastActiveAt: row.lastActiveAt?.toISOString() ?? null,
    user: {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      avatarUrl: row.user.avatarUrl,
      jobTitle: row.user.jobTitle,
      timezone: row.user.timezone,
    },
  };
}

export function toInvitationDto(row: InvitationRow, now = new Date()): InvitationDto {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.expiresAt <= now ? 'EXPIRED' : 'PENDING',
    invitedBy: toUserSummary(row.invitedBy, row.invitedById ?? ''),
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}
