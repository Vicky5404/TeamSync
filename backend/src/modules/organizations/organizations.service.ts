import { Injectable, Logger } from '@nestjs/common';

import { AccessResolver } from '../../common/authorization/access-resolver.service.js';
import type { AccessContext } from '../../common/auth/auth.types.js';
import { Errors } from '../../common/errors/api-exception.js';
import { isUniqueViolation } from '../../common/errors/prisma-errors.js';
import { Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { QueueService } from '../../infrastructure/queue/queue.service.js';
import { CacheService } from '../../infrastructure/redis/cache.service.js';
import { StorageKeys } from '../../infrastructure/storage/storage-keys.js';
import { ActivityService } from '../activity/activity.service.js';
import { ActivityAction } from '../activity/activity.types.js';
import { analyticsNamespace } from '../analytics/analytics-cache.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction, auditBase } from '../audit/audit.types.js';
import { Channels, RealtimeEvent } from '../realtime/realtime.events.js';
import { RealtimePublisher } from '../realtime/realtime.publisher.js';

import type {
  CreateOrganizationDto,
  OrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto.js';
import { toMemberDto, toOrganizationDto } from './organization.mapper.js';
import { OrganizationsRepository } from './organizations.repository.js';

const slugTaken = () =>
  Errors.conflict('That URL is already taken.', { slug: ['This URL is already taken'] });

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsRepository,
    private readonly access: AccessResolver,
    private readonly activity: ActivityService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimePublisher,
    private readonly queue: QueueService,
    private readonly cache: CacheService,
  ) {}

  async listForUser(userId: string): Promise<OrganizationDto[]> {
    const memberships = await this.organizations.listForUser(userId);
    return memberships.map(({ role, organization }) =>
      toOrganizationDto(organization, role, organization._count.memberships),
    );
  }

  async create(userId: string, input: CreateOrganizationDto): Promise<OrganizationDto> {
    try {
      const { organization } = await this.organizations.createWithOwner(input, userId);
      await this.access.invalidateMembership(organization.id, userId);
      this.logger.log({ organizationId: organization.id, userId }, 'Organization created');
      return toOrganizationDto(organization, Role.OWNER, 1);
    } catch (error) {
      if (isUniqueViolation(error)) throw slugTaken();
      throw error;
    }
  }

  async get(access: AccessContext): Promise<OrganizationDto> {
    const organization = await this.organizations.findById(access.organizationId);
    if (!organization) throw Errors.notFound('Organization');
    return toOrganizationDto(
      organization,
      access.role,
      await this.organizations.memberCount(organization.id),
    );
  }

  async update(access: AccessContext, input: UpdateOrganizationDto): Promise<OrganizationDto> {
    try {
      const organization = await this.prisma.$transaction(async (tx) => {
        const before = await tx.organization.findUniqueOrThrow({
          where: { id: access.organizationId },
          select: { name: true, slug: true },
        });
        const updated = await tx.organization.update({
          where: { id: access.organizationId },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.slug !== undefined ? { slug: input.slug } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
          },
        });
        await this.activity.record(
          {
            organizationId: updated.id,
            actorId: access.userId,
            action: ActivityAction.ORGANIZATION_UPDATED,
            target: { type: 'organization', id: updated.id, name: updated.name },
            metadata: { fields: Object.keys(input).join(',') },
          },
          tx,
        );
        await this.audit.record(
          {
            ...auditBase(access),
            action: AuditAction.ORGANIZATION_UPDATED,
            entityType: 'organization',
            entityId: updated.id,
            metadata: {
              fields: Object.keys(input).join(','),
              ...(before.name !== updated.name
                ? { fromName: before.name, toName: updated.name }
                : {}),
              ...(before.slug !== updated.slug
                ? { fromSlug: before.slug, toSlug: updated.slug }
                : {}),
            },
          },
          tx,
        );
        return updated;
      });
      return toOrganizationDto(
        organization,
        access.role,
        await this.organizations.memberCount(organization.id),
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw slugTaken();
      throw error;
    }
  }

  /**
   * Deletes the organization and everything in it (a hard delete: the tenant's
   * data is erased, including its audit trail); stored files are purged
   * asynchronously. The deletion itself is recorded as a platform-level audit
   * entry, which survives because it is not owned by the organization.
   */
  async delete(access: AccessContext): Promise<void> {
    const userIds = await this.organizations.allUserIds(access.organizationId);
    await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.delete({ where: { id: access.organizationId } });
      await this.audit.record(
        {
          ...auditBase(access),
          organizationId: null,
          action: AuditAction.ORGANIZATION_DELETED,
          entityType: 'organization',
          entityId: organization.id,
          metadata: { name: organization.name, slug: organization.slug, members: userIds.length },
        },
        tx,
      );
    });
    await this.access.invalidateMembership(access.organizationId, ...userIds);
    await this.queue.purgeStoragePrefix(StorageKeys.organization(access.organizationId));
    for (const userId of userIds)
      void this.realtime.revokeOrganizationAccess(userId, access.organizationId);
    this.logger.log(
      { organizationId: access.organizationId, userId: access.userId },
      'Organization deleted',
    );
  }

  async leave(access: AccessContext): Promise<void> {
    if (access.role === Role.OWNER) {
      throw Errors.badRequest('Owners must transfer ownership before leaving the organization.');
    }
    const member = await this.organizations.findMember(access.organizationId, access.membershipId);
    if (!member) throw Errors.notFound('Member');
    await this.prisma.$transaction(async (tx) => {
      await this.organizations.detachMember(tx, access.organizationId, member.id, access.userId);
      await this.activity.record(
        {
          organizationId: access.organizationId,
          actorId: access.userId,
          action: ActivityAction.MEMBER_LEFT,
          target: { type: 'organization', id: access.organizationId, name: member.user.name },
        },
        tx,
      );
      await this.audit.record(
        {
          ...auditBase(access),
          action: AuditAction.MEMBER_LEFT,
          entityType: 'member',
          entityId: member.id,
          metadata: { userId: access.userId, role: member.role },
        },
        tx,
      );
    });
    await this.afterMembershipRemoved(access.organizationId, member.id, access.userId);
  }

  /** The owner hands ownership to another member and becomes an admin. */
  async transferOwnership(access: AccessContext, memberId: string): Promise<void> {
    if (access.role !== Role.OWNER)
      throw Errors.forbidden('Only the owner can transfer ownership.');
    const [target, actor] = await Promise.all([
      this.organizations.findMember(access.organizationId, memberId),
      this.organizations.findMember(access.organizationId, access.membershipId),
    ]);
    if (!target || !actor) throw Errors.notFound('Member');
    if (target.userId === access.userId)
      throw Errors.badRequest('You already own this organization.');

    await this.prisma.$transaction(async (tx) => {
      await tx.membership.update({ where: { id: target.id }, data: { role: Role.OWNER } });
      await tx.membership.update({
        where: { id: access.membershipId },
        data: { role: Role.ADMIN },
      });
      await this.activity.record(
        [
          {
            organizationId: access.organizationId,
            actorId: access.userId,
            action: ActivityAction.MEMBER_ROLE_CHANGED,
            target: { type: 'member', id: target.id, name: target.user.name },
            metadata: { from: target.role, to: Role.OWNER },
          },
          {
            organizationId: access.organizationId,
            actorId: access.userId,
            action: ActivityAction.MEMBER_ROLE_CHANGED,
            target: { type: 'member', id: actor.id, name: actor.user.name },
            metadata: { from: Role.OWNER, to: Role.ADMIN },
          },
        ],
        tx,
      );
      await this.audit.record(
        {
          ...auditBase(access),
          action: AuditAction.OWNERSHIP_TRANSFERRED,
          entityType: 'member',
          entityId: target.id,
          metadata: { fromUserId: access.userId, toUserId: target.userId, name: target.user.name },
        },
        tx,
      );
    });
    await this.access.invalidateMembership(access.organizationId, target.userId, access.userId);
    for (const memberIdToPublish of [target.id, access.membershipId]) {
      const member = await this.organizations.findMember(access.organizationId, memberIdToPublish);
      if (member) {
        void this.realtime.publish(
          RealtimeEvent.MEMBER_UPDATED,
          [Channels.organization(access.organizationId)],
          {
            organizationId: access.organizationId,
            action: 'updated',
            member: toMemberDto(member),
          },
        );
      }
    }
  }

  /** Shared follow-up after a membership disappears (leave or removal). */
  async afterMembershipRemoved(
    organizationId: string,
    membershipId: string,
    userId: string,
  ): Promise<void> {
    await this.access.invalidateMembership(organizationId, userId);
    await this.cache.bumpVersion(analyticsNamespace(organizationId));
    // The removed user's organization subscriptions are revoked below, so they
    // learn about the removal on their private channel.
    await this.realtime.publish(
      RealtimeEvent.MEMBER_UPDATED,
      [Channels.organization(organizationId), Channels.user(userId)],
      {
        organizationId,
        action: 'removed',
        memberId: membershipId,
        userId,
      },
    );
    void this.realtime.revokeOrganizationAccess(userId, organizationId);
  }
}
