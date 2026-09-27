import { Injectable, Logger } from '@nestjs/common';

import { AccessResolver } from '../../common/authorization/access-resolver.service.js';
import { assignableRoles } from '../../common/authorization/permissions.js';
import type { AccessContext } from '../../common/auth/auth.types.js';
import { ErrorCode, Errors } from '../../common/errors/api-exception.js';
import { isUniqueViolation } from '../../common/errors/prisma-errors.js';
import { generateToken, sha256 } from '../../common/utils/crypto.js';
import { AppConfig } from '../../config/app-config.js';
import type { Invitation, User } from '../../generated/prisma/client.js';
import { NotificationType, Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { QueueService } from '../../infrastructure/queue/queue.service.js';
import { CacheService } from '../../infrastructure/redis/cache.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { ActivityAction } from '../activity/activity.types.js';
import { analyticsNamespace } from '../analytics/analytics-cache.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction, auditBase } from '../audit/audit.types.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { Channels, RealtimeEvent } from '../realtime/realtime.events.js';
import { RealtimePublisher } from '../realtime/realtime.publisher.js';

import type {
  InvitationDto,
  InviteMembersDto,
  InviteMembersResultDto,
  OrganizationDto,
} from './dto/organization.dto.js';
import {
  invitationInclude,
  toInvitationDto,
  toMemberDto,
  toOrganizationDto,
} from './organization.mapper.js';
import { OrganizationsRepository } from './organizations.repository.js';

const INVITATION_TTL_MS = 7 * 86_400_000;

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsRepository,
    private readonly access: AccessResolver,
    private readonly activity: ActivityService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimePublisher,
    private readonly queue: QueueService,
    private readonly cache: CacheService,
    private readonly config: AppConfig,
  ) {}

  async list(organizationId: string): Promise<InvitationDto[]> {
    const rows = await this.prisma.invitation.findMany({
      where: { organizationId },
      include: invitationInclude,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const now = new Date();
    return rows.map((row) => toInvitationDto(row, now));
  }

  async invite(access: AccessContext, input: InviteMembersDto): Promise<InviteMembersResultDto> {
    if (!assignableRoles(access.role).includes(input.role)) {
      throw Errors.validation({ role: ['You cannot invite people with this role'] });
    }
    const emails = Array.from(new Set(input.emails));
    const now = new Date();

    const [organization, inviter, members, pending] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({ where: { id: access.organizationId } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: access.userId }, select: { name: true } }),
      this.prisma.membership.findMany({
        where: { organizationId: access.organizationId, user: { email: { in: emails } } },
        select: { user: { select: { email: true } } },
      }),
      this.prisma.invitation.findMany({
        where: { organizationId: access.organizationId, email: { in: emails } },
        select: { id: true, email: true, expiresAt: true },
      }),
    ]);
    const memberEmails = new Set(members.map((member) => member.user.email));
    const pendingByEmail = new Map(pending.map((invitation) => [invitation.email, invitation]));

    const skipped: InviteMembersResultDto['skipped'] = [];
    const toInvite: Array<{ email: string; token: string }> = [];
    const expiredIds: string[] = [];
    for (const email of emails) {
      const existing = pendingByEmail.get(email);
      if (memberEmails.has(email)) skipped.push({ email, reason: 'already a member' });
      else if (existing && existing.expiresAt > now)
        skipped.push({ email, reason: 'already invited' });
      else {
        if (existing) expiredIds.push(existing.id);
        toInvite.push({ email, token: generateToken() });
      }
    }

    const created = await this.prisma
      .$transaction(async (tx) => {
        if (expiredIds.length > 0)
          await tx.invitation.deleteMany({ where: { id: { in: expiredIds } } });
        // One INSERT for the whole batch (up to 50 addresses).
        const rows =
          toInvite.length === 0
            ? []
            : await tx.invitation.createManyAndReturn({
                data: toInvite.map(({ email, token }) => ({
                  organizationId: access.organizationId,
                  email,
                  role: input.role,
                  message: input.message ?? null,
                  tokenHash: sha256(token),
                  invitedById: access.userId,
                  expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
                })),
                include: invitationInclude,
              });
        await this.activity.record(
          rows.map((row) => ({
            organizationId: access.organizationId,
            actorId: access.userId,
            action: ActivityAction.MEMBER_INVITED,
            target: { type: 'organization' as const, id: access.organizationId, name: row.email },
            metadata: { email: row.email, role: row.role },
          })),
          tx,
        );
        await this.audit.record(
          rows.map((row) => ({
            ...auditBase(access),
            action: AuditAction.MEMBER_INVITED,
            entityType: 'invitation' as const,
            entityId: row.id,
            metadata: { email: row.email, role: row.role },
          })),
          tx,
        );
        return rows;
      })
      .catch((error: unknown) => {
        // (organization, email) is unique: a concurrent request invited the same address.
        if (isUniqueViolation(error)) {
          throw Errors.conflict('Some of these people were just invited. Refresh and try again.');
        }
        throw error;
      });

    const tokens = new Map(toInvite.map(({ email, token }) => [email, token]));
    for (const row of created) {
      const token = tokens.get(row.email);
      if (!token) continue;
      await this.sendInvitationEmail(row, token, organization.name, inviter.name);
    }
    return { invited: created.map((row) => toInvitationDto(row, now)), skipped };
  }

  /** Issue a fresh link and extend the expiry. */
  async resend(access: AccessContext, invitationId: string): Promise<InvitationDto> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: access.organizationId },
    });
    if (!invitation) throw Errors.notFound('Invitation');
    const token = generateToken();
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          tokenHash: sha256(token),
          invitedById: access.userId,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        },
        include: invitationInclude,
      });
      await this.audit.record(
        {
          ...auditBase(access),
          action: AuditAction.INVITATION_RESENT,
          entityType: 'invitation',
          entityId: row.id,
          metadata: { email: row.email, role: row.role },
        },
        tx,
      );
      return row;
    });
    const [organization, inviter] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({
        where: { id: access.organizationId },
        select: { name: true },
      }),
      this.prisma.user.findUniqueOrThrow({ where: { id: access.userId }, select: { name: true } }),
    ]);
    await this.sendInvitationEmail(updated, token, organization.name, inviter.name);
    return toInvitationDto(updated);
  }

  async revoke(access: AccessContext, invitationId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findFirst({
        where: { id: invitationId, organizationId: access.organizationId },
        select: { id: true, email: true, role: true },
      });
      if (!invitation) throw Errors.notFound('Invitation');
      await tx.invitation.delete({ where: { id: invitation.id } });
      await this.audit.record(
        {
          ...auditBase(access),
          action: AuditAction.INVITATION_REVOKED,
          entityType: 'invitation',
          entityId: invitation.id,
          metadata: { email: invitation.email, role: invitation.role },
        },
        tx,
      );
    });
  }

  /** Accept an invitation link; it must have been sent to the signed-in user's email. */
  async acceptByToken(userId: string, token: string): Promise<OrganizationDto> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!invitation || invitation.expiresAt <= new Date()) {
      throw Errors.badRequest(
        'This invitation is invalid or has expired.',
        ErrorCode.INVALID_TOKEN,
      );
    }
    if (invitation.email !== user.email) {
      throw Errors.forbidden('This invitation was sent to a different email address.');
    }
    await this.join(invitation, user);
    const membership = await this.organizations.findMemberByUser(
      invitation.organizationId,
      user.id,
    );
    const organization = await this.organizations.findById(invitation.organizationId);
    if (!membership || !organization) throw Errors.notFound('Organization');
    return toOrganizationDto(
      organization,
      membership.role,
      await this.organizations.memberCount(organization.id),
    );
  }

  /** After a new account verifies its email, join every organization that invited that address. */
  async acceptPendingForUser(user: User): Promise<void> {
    const invitations = await this.prisma.invitation.findMany({
      where: { email: user.email, expiresAt: { gt: new Date() } },
    });
    for (const invitation of invitations) {
      try {
        await this.join(invitation, user);
      } catch (error) {
        this.logger.error(
          { err: error, invitationId: invitation.id },
          'Failed to accept invitation',
        );
      }
    }
  }

  private async join(invitation: Invitation, user: User): Promise<void> {
    const membership = await this.prisma
      .$transaction(async (tx) => {
        await tx.invitation.delete({ where: { id: invitation.id } });
        const existing = await tx.membership.findUnique({
          where: {
            organizationId_userId: { organizationId: invitation.organizationId, userId: user.id },
          },
        });
        if (existing) return null;
        const created = await tx.membership.create({
          data: {
            organizationId: invitation.organizationId,
            userId: user.id,
            role: invitation.role,
          },
        });
        await this.activity.record(
          {
            organizationId: invitation.organizationId,
            actorId: user.id,
            action: ActivityAction.MEMBER_JOINED,
            target: { type: 'member', id: created.id, name: user.name },
            metadata: { role: invitation.role },
          },
          tx,
        );
        await this.audit.record(
          {
            organizationId: invitation.organizationId,
            actorId: user.id,
            action: AuditAction.MEMBER_JOINED,
            entityType: 'member',
            entityId: created.id,
            metadata: {
              email: user.email,
              role: invitation.role,
              invitedById: invitation.invitedById,
            },
          },
          tx,
        );
        return created;
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) return null;
        throw error;
      });
    if (!membership) return;

    await this.access.invalidateMembership(invitation.organizationId, user.id);
    await this.cache.bumpVersion(analyticsNamespace(invitation.organizationId));

    const recipients = await this.organizations.userIdsWithRoles(invitation.organizationId, [
      Role.OWNER,
      Role.ADMIN,
      Role.MANAGER,
    ]);
    await this.notifications.notify(
      recipients.map((recipientId) => ({
        userId: recipientId,
        type: NotificationType.MEMBER_JOINED,
        title: `${user.name} joined the organization`,
        body: null,
        actorId: user.id,
        organizationId: invitation.organizationId,
        resource: { type: 'organization', id: invitation.organizationId },
      })),
    );
    const member = await this.organizations.findMember(invitation.organizationId, membership.id);
    if (member) {
      void this.realtime.publish(
        RealtimeEvent.MEMBER_UPDATED,
        [Channels.organization(invitation.organizationId)],
        {
          organizationId: invitation.organizationId,
          action: 'joined',
          member: toMemberDto(member),
        },
      );
    }
  }

  /** "Member invited" delivery goes out by email (the invitee may not have an account yet). */
  private async sendInvitationEmail(
    invitation: Invitation,
    token: string,
    organizationName: string,
    inviterName: string,
  ): Promise<void> {
    await this.queue.sendEmail({
      to: invitation.email,
      template: 'invitation',
      data: {
        organizationName,
        inviterName,
        role: invitation.role,
        message: invitation.message,
        link: this.config.appLink('/accept-invitation', { token }),
      },
    });
  }
}
