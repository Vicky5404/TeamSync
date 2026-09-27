import { Injectable } from '@nestjs/common';

import { AccessResolver } from '../../common/authorization/access-resolver.service.js';
import {
  assignableRoles,
  canManageMember,
  ROLE_RANK,
} from '../../common/authorization/permissions.js';
import type { AccessContext } from '../../common/auth/auth.types.js';
import { Errors } from '../../common/errors/api-exception.js';
import { startOfTodayUTC } from '../../common/utils/dates.js';
import { type Role, TaskStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { ActivityAction } from '../activity/activity.types.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction, auditBase } from '../audit/audit.types.js';
import { projectTaskStats } from '../projects/project-stats.js';
import { Channels, RealtimeEvent } from '../realtime/realtime.events.js';
import { RealtimePublisher } from '../realtime/realtime.publisher.js';

import type { MemberDto, MemberListQueryDto, MemberProfileDto } from './dto/organization.dto.js';
import { toMemberDto } from './organization.mapper.js';
import { OrganizationsRepository } from './organizations.repository.js';
import { OrganizationsService } from './organizations.service.js';

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsRepository,
    private readonly organizationsService: OrganizationsService,
    private readonly access: AccessResolver,
    private readonly activity: ActivityService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimePublisher,
  ) {}

  async list(organizationId: string, query: MemberListQueryDto): Promise<MemberDto[]> {
    const members = await this.organizations.listMembers(organizationId, query);
    return members
      .map(toMemberDto)
      .sort(
        (a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role] || a.user.name.localeCompare(b.user.name),
      );
  }

  async profile(organizationId: string, memberId: string): Promise<MemberProfileDto> {
    const member = await this.organizations.findMember(organizationId, memberId);
    if (!member) throw Errors.notFound('Member');
    const userId = member.userId;
    const today = startOfTodayUTC();

    const [byStatus, overdueTasks, projects] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        where: { organizationId, assigneeId: userId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.task.count({
        where: {
          organizationId,
          assigneeId: userId,
          deletedAt: null,
          status: { not: TaskStatus.DONE },
          dueDate: { lt: today },
        },
      }),
      this.prisma.project.findMany({
        where: { organizationId, deletedAt: null, members: { some: { userId } } },
        select: { id: true, name: true, key: true, status: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const stats = await projectTaskStats(
      this.prisma,
      projects.map((project) => project.id),
      today,
    );
    const completedTasks = byStatus.find((row) => row.status === TaskStatus.DONE)?._count._all ?? 0;
    const allTasks = byStatus.reduce((sum, row) => sum + row._count._all, 0);

    return {
      ...toMemberDto(member),
      stats: {
        openTasks: allTasks - completedTasks,
        completedTasks,
        overdueTasks,
        projects: projects.length,
      },
      projects: projects.map((project) => ({
        ...project,
        progress: stats.get(project.id)?.progress ?? 0,
      })),
    };
  }

  async updateRole(access: AccessContext, memberId: string, role: Role): Promise<MemberDto> {
    const target = await this.organizations.findMember(access.organizationId, memberId);
    if (!target) throw Errors.notFound('Member');
    if (target.userId === access.userId || !canManageMember(access.role, target.role))
      throw Errors.forbidden();
    if (!assignableRoles(access.role).includes(role))
      throw Errors.forbidden('You cannot assign this role.');
    if (target.role === role) return toMemberDto(target);

    const updated = await this.prisma.$transaction(async (tx) => {
      const member = await tx.membership.update({ where: { id: target.id }, data: { role } });
      await this.activity.record(
        {
          organizationId: access.organizationId,
          actorId: access.userId,
          action: ActivityAction.MEMBER_ROLE_CHANGED,
          target: { type: 'member', id: target.id, name: target.user.name },
          metadata: { from: target.role, to: role },
        },
        tx,
      );
      await this.audit.record(
        {
          ...auditBase(access),
          action: AuditAction.MEMBER_ROLE_CHANGED,
          entityType: 'member',
          entityId: target.id,
          metadata: { userId: target.userId, name: target.user.name, from: target.role, to: role },
        },
        tx,
      );
      return { ...target, role: member.role };
    });

    await this.access.invalidateMembership(access.organizationId, target.userId);
    const dto = toMemberDto(updated);
    void this.realtime.publish(
      RealtimeEvent.MEMBER_UPDATED,
      [Channels.organization(access.organizationId)],
      {
        organizationId: access.organizationId,
        action: 'updated',
        member: dto,
      },
    );
    return dto;
  }

  async remove(access: AccessContext, memberId: string): Promise<void> {
    const target = await this.organizations.findMember(access.organizationId, memberId);
    if (!target) throw Errors.notFound('Member');
    if (target.userId === access.userId || !canManageMember(access.role, target.role))
      throw Errors.forbidden();

    await this.prisma.$transaction(async (tx) => {
      await this.organizations.detachMember(tx, access.organizationId, target.id, target.userId);
      await this.activity.record(
        {
          organizationId: access.organizationId,
          actorId: access.userId,
          action: ActivityAction.MEMBER_REMOVED,
          target: { type: 'organization', id: access.organizationId, name: target.user.name },
          metadata: { role: target.role },
        },
        tx,
      );
      await this.audit.record(
        {
          ...auditBase(access),
          action: AuditAction.MEMBER_REMOVED,
          entityType: 'member',
          entityId: target.id,
          metadata: {
            userId: target.userId,
            name: target.user.name,
            email: target.user.email,
            role: target.role,
          },
        },
        tx,
      );
    });
    await this.organizationsService.afterMembershipRemoved(
      access.organizationId,
      target.id,
      target.userId,
    );
  }
}
