import { Injectable } from '@nestjs/common';

import type { Organization, Prisma } from '../../generated/prisma/client.js';
import { Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

import { memberInclude, type MemberRow } from './organization.mapper.js';

type Db = PrismaService | Prisma.TransactionClient;

const DEFAULT_LABELS = [
  { name: 'Bug', color: 'red' },
  { name: 'Feature', color: 'blue' },
  { name: 'Design', color: 'violet' },
  { name: 'Docs', color: 'gray' },
  { name: 'Quick win', color: 'green' },
] as const;

/** Data access for organizations and memberships. */
@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createWithOwner(
    data: { name: string; slug: string },
    ownerId: string,
  ): Promise<{ organization: Organization; membershipId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({ data });
      const membership = await tx.membership.create({
        data: {
          organizationId: organization.id,
          userId: ownerId,
          role: Role.OWNER,
          lastActiveAt: new Date(),
        },
      });
      await tx.label.createMany({
        data: DEFAULT_LABELS.map((label) => ({ ...label, organizationId: organization.id })),
      });
      return { organization, membershipId: membership.id };
    });
  }

  findById(organizationId: string) {
    return this.prisma.organization.findUnique({ where: { id: organizationId } });
  }

  memberCount(organizationId: string, db: Db = this.prisma): Promise<number> {
    return db.membership.count({ where: { organizationId } });
  }

  /** The user's organizations with their role and member counts. */
  listForUser(userId: string) {
    return this.prisma.membership.findMany({
      where: { userId },
      select: {
        role: true,
        organization: { include: { _count: { select: { memberships: true } } } },
      },
      orderBy: { organization: { name: 'asc' } },
    });
  }

  findMember(
    organizationId: string,
    memberId: string,
    db: Db = this.prisma,
  ): Promise<MemberRow | null> {
    return db.membership.findFirst({
      where: { id: memberId, organizationId },
      include: memberInclude,
    });
  }

  findMemberByUser(
    organizationId: string,
    userId: string,
    db: Db = this.prisma,
  ): Promise<MemberRow | null> {
    return db.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      include: memberInclude,
    });
  }

  listMembers(
    organizationId: string,
    filters: { search?: string; role?: Role },
  ): Promise<MemberRow[]> {
    const search = filters.search;
    return this.prisma.membership.findMany({
      where: {
        organizationId,
        ...(filters.role ? { role: filters.role } : {}),
        ...(search
          ? {
              user: {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      include: memberInclude,
      take: 1000,
    });
  }

  /** User ids of members holding one of `roles` (e.g. who to tell about new members). */
  async userIdsWithRoles(organizationId: string, roles: Role[]): Promise<string[]> {
    const rows = await this.prisma.membership.findMany({
      where: { organizationId, role: { in: roles } },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  }

  async allUserIds(organizationId: string): Promise<string[]> {
    const rows = await this.prisma.membership.findMany({
      where: { organizationId },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  }

  /**
   * Remove a member and everything that only makes sense while they belong to
   * the organization. Order matters: the database refuses to delete a
   * membership that tasks (including ones in the trash) are still assigned to,
   * and deleting it cascades to the member's project memberships.
   */
  async detachMember(
    tx: Prisma.TransactionClient,
    organizationId: string,
    membershipId: string,
    userId: string,
  ) {
    await tx.task.updateMany({
      where: { organizationId, assigneeId: userId },
      data: { assigneeId: null },
    });
    await tx.membership.delete({ where: { id: membershipId } });
  }
}
