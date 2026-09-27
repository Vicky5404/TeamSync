import { Injectable, Logger } from '@nestjs/common';

import { AccessResolver } from '../../common/authorization/access-resolver.service.js';
import type { AccessContext } from '../../common/auth/auth.types.js';
import { Errors } from '../../common/errors/api-exception.js';
import { isUniqueViolation } from '../../common/errors/prisma-errors.js';
import { fromNullableISODate, toISODate } from '../../common/utils/dates.js';
import { type Paginated, paginated } from '../../common/utils/pagination.js';
import { NotificationType, ProjectStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { CacheService } from '../../infrastructure/redis/cache.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { ActivityAction, type ActivityTarget } from '../activity/activity.types.js';
import { analyticsNamespace } from '../analytics/analytics-cache.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction, auditBase } from '../audit/audit.types.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeEvent } from '../realtime/realtime.events.js';
import { RealtimePublisher } from '../realtime/realtime.publisher.js';

import type {
  CreateProjectDto,
  ProjectDto,
  ProjectListQueryDto,
  UpdateProjectDto,
} from './dto/project.dto.js';
import { projectInclude, type ProjectRow, toProjectDto } from './project.mapper.js';
import { ProjectsRepository } from './projects.repository.js';

const keyTaken = () =>
  Errors.conflict('That key is already used by another project.', {
    key: ['This key is already in use'],
  });

const projectTarget = (project: { id: string; name: string }): ActivityTarget => ({
  type: 'project',
  id: project.id,
  name: project.name,
});

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsRepository,
    private readonly access: AccessResolver,
    private readonly activity: ActivityService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimePublisher,
    private readonly cache: CacheService,
  ) {}

  async list(organizationId: string, query: ProjectListQueryDto): Promise<Paginated<ProjectDto>> {
    const { rows, stats, total, window } = await this.projects.list(
      organizationId,
      {
        ...(query.search ? { search: query.search } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      query.sort ?? 'updated',
      query.page,
      query.pageSize,
    );
    return paginated(
      rows.map((row) => toProjectDto(row, stats.get(row.id))),
      total,
      window,
    );
  }

  async get(access: AccessContext): Promise<ProjectDto> {
    const project = await this.requireProject(access);
    return this.toDto(project);
  }

  async create(access: AccessContext, input: CreateProjectDto): Promise<ProjectDto> {
    this.assertDateOrder(input.startDate, input.dueDate);
    const requested = await this.projects.organizationUserIds(
      access.organizationId,
      input.memberIds ?? [],
    );
    const memberIds = Array.from(new Set([access.userId, ...requested]));

    let project: ProjectRow;
    try {
      project = await this.prisma.$transaction(async (tx) => {
        const created = await tx.project.create({
          data: {
            organizationId: access.organizationId,
            key: input.key,
            name: input.name,
            description: input.description ?? null,
            status: input.status ?? ProjectStatus.PLANNING,
            ownerId: access.userId,
            startDate: fromNullableISODate(input.startDate) ?? null,
            dueDate: fromNullableISODate(input.dueDate) ?? null,
            members: { create: memberIds.map((userId) => ({ userId })) },
          },
          include: projectInclude,
        });
        await this.activity.record(
          {
            organizationId: access.organizationId,
            projectId: created.id,
            actorId: access.userId,
            action: ActivityAction.PROJECT_CREATED,
            target: projectTarget(created),
          },
          tx,
        );
        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw keyTaken();
      throw error;
    }

    await this.notifyAdded(access, project, memberIds);
    await this.afterChange(access.organizationId, project.id);
    return toProjectDto(project);
  }

  async update(access: AccessContext, input: UpdateProjectDto): Promise<ProjectDto> {
    const current = await this.requireProject(access);
    const startDate =
      input.startDate !== undefined ? input.startDate : toISODate(current.startDate);
    const dueDate = input.dueDate !== undefined ? input.dueDate : toISODate(current.dueDate);
    this.assertDateOrder(startDate, dueDate);

    const currentMemberIds = current.members.map((member) => member.user.id);
    const nextMemberIds =
      input.memberIds !== undefined
        ? await this.projects.organizationUserIds(access.organizationId, input.memberIds)
        : undefined;
    const added = nextMemberIds?.filter((id) => !currentMemberIds.includes(id)) ?? [];
    const removed = nextMemberIds
      ? currentMemberIds.filter((id) => !nextMemberIds.includes(id))
      : [];
    const changedFields = Object.keys(input).filter(
      (field) => field !== 'memberIds' || added.length || removed.length,
    );

    let project: ProjectRow;
    try {
      project = await this.prisma.$transaction(async (tx) => {
        if (removed.length)
          await tx.projectMember.deleteMany({
            where: { projectId: current.id, userId: { in: removed } },
          });
        if (added.length) {
          await tx.projectMember.createMany({
            data: added.map((userId) => ({
              projectId: current.id,
              userId,
              organizationId: access.organizationId,
            })),
            skipDuplicates: true,
          });
        }
        const updated = await tx.project.update({
          where: { id: current.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.key !== undefined ? { key: input.key } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.startDate !== undefined
              ? { startDate: fromNullableISODate(input.startDate) }
              : {}),
            ...(input.dueDate !== undefined ? { dueDate: fromNullableISODate(input.dueDate) } : {}),
          },
          include: projectInclude,
        });
        if (changedFields.length > 0) {
          await this.activity.record(
            {
              organizationId: access.organizationId,
              projectId: updated.id,
              actorId: access.userId,
              action: ActivityAction.PROJECT_UPDATED,
              target: projectTarget(updated),
              metadata: {
                fields: changedFields.join(','),
                ...(input.status && input.status !== current.status
                  ? { from: current.status, to: input.status }
                  : {}),
              },
            },
            tx,
          );
        }
        return updated;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw keyTaken();
      throw error;
    }

    await this.notifyAdded(access, project, added);
    await this.afterChange(access.organizationId, project.id);
    return this.toDto(project);
  }

  /**
   * Move a project to the trash. Its live tasks are trashed with the same
   * timestamp so a restore brings back exactly those; the key is released
   * immediately. The maintenance job purges it (and its files) after 30 days.
   */
  async delete(access: AccessContext): Promise<void> {
    const project = await this.requireProject(access);
    const deletedAt = new Date();
    const taskIds = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.project.updateMany({
        where: { id: project.id, deletedAt: null },
        data: { deletedAt },
      });
      if (count === 0) throw Errors.notFound('Project');
      const tasks = await tx.task.updateManyAndReturn({
        where: { projectId: project.id, deletedAt: null },
        data: { deletedAt },
        select: { id: true },
      });
      await this.activity.record(
        {
          organizationId: access.organizationId,
          actorId: access.userId,
          action: ActivityAction.PROJECT_DELETED,
          target: { type: 'organization', id: access.organizationId, name: project.name },
          metadata: { key: project.key },
        },
        tx,
      );
      await this.audit.record(
        {
          ...auditBase(access),
          action: AuditAction.PROJECT_DELETED,
          entityType: 'project',
          entityId: project.id,
          metadata: { key: project.key, name: project.name, tasks: tasks.length },
        },
        tx,
      );
      return tasks.map((task) => task.id);
    });
    await this.access.forgetProject(project.id);
    await this.access.forgetTasks(...taskIds);
    await this.afterChange(access.organizationId, project.id, { deleted: true });
    this.logger.log({ projectId: project.id, userId: access.userId }, 'Project moved to trash');
  }

  /** Restore a project from the trash together with the tasks that were trashed with it. */
  async restore(access: AccessContext): Promise<ProjectDto> {
    if (!access.projectId) throw Errors.notFound('Project');
    const trashed = await this.prisma.project.findFirst({
      where: { id: access.projectId, organizationId: access.organizationId },
      select: { id: true, key: true, name: true, deletedAt: true },
    });
    if (!trashed) throw Errors.notFound('Project');

    const { deletedAt } = trashed;
    if (deletedAt) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const { count } = await tx.project.updateMany({
            where: { id: trashed.id, deletedAt },
            data: { deletedAt: null },
          });
          if (count === 0) return; // restored concurrently
          const tasks = await tx.task.updateMany({
            where: { projectId: trashed.id, deletedAt },
            data: { deletedAt: null },
          });
          await this.activity.record(
            {
              organizationId: access.organizationId,
              projectId: trashed.id,
              actorId: access.userId,
              action: ActivityAction.PROJECT_RESTORED,
              target: projectTarget(trashed),
            },
            tx,
          );
          await this.audit.record(
            {
              ...auditBase(access),
              action: AuditAction.PROJECT_RESTORED,
              entityType: 'project',
              entityId: trashed.id,
              metadata: { key: trashed.key, name: trashed.name, tasks: tasks.count },
            },
            tx,
          );
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw Errors.conflict(
            `Another project now uses the key ${trashed.key}. Change its key, then restore this project.`,
            { key: ['This key is already in use'] },
          );
        }
        throw error;
      }
    }

    const project = await this.requireProject(access);
    await this.afterChange(access.organizationId, project.id);
    return this.toDto(project);
  }

  async addMember(access: AccessContext, userId: string): Promise<ProjectDto> {
    const project = await this.requireProject(access);
    const [valid] = await this.projects.organizationUserIds(access.organizationId, [userId]);
    if (!valid) throw Errors.field('userId', 'User must be a member of the organization');
    if (project.members.some((member) => member.user.id === userId)) return this.toDto(project);

    await this.prisma.$transaction(async (tx) => {
      await tx.projectMember.create({
        data: { projectId: project.id, userId, organizationId: access.organizationId },
      });
      await this.activity.record(
        {
          organizationId: access.organizationId,
          projectId: project.id,
          actorId: access.userId,
          action: ActivityAction.PROJECT_MEMBER_ADDED,
          target: projectTarget(project),
          metadata: { userId },
        },
        tx,
      );
    });
    const updated = await this.requireProject(access);
    await this.notifyAdded(access, updated, [userId]);
    await this.afterChange(access.organizationId, project.id);
    return this.toDto(updated);
  }

  async removeMember(access: AccessContext, userId: string): Promise<void> {
    const project = await this.requireProject(access);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.projectMember.deleteMany({
        where: { projectId: project.id, userId },
      });
      if (count === 0) throw Errors.notFound('Project member');
      await this.activity.record(
        {
          organizationId: access.organizationId,
          projectId: project.id,
          actorId: access.userId,
          action: ActivityAction.PROJECT_MEMBER_REMOVED,
          target: projectTarget(project),
          metadata: { userId },
        },
        tx,
      );
    });
    await this.afterChange(access.organizationId, project.id);
  }

  // -------------------------------------------------------------------------

  private async requireProject(access: AccessContext): Promise<ProjectRow> {
    if (!access.projectId) throw Errors.notFound('Project');
    const project = await this.projects.findInOrganization(access.organizationId, access.projectId);
    if (!project) throw Errors.notFound('Project');
    return project;
  }

  private async toDto(project: ProjectRow): Promise<ProjectDto> {
    const stats = await this.projects.stats([project.id]);
    return toProjectDto(project, stats.get(project.id));
  }

  private assertDateOrder(
    startDate: string | null | undefined,
    dueDate: string | null | undefined,
  ): void {
    if (startDate && dueDate && dueDate < startDate) {
      throw Errors.field('dueDate', 'Due date must be on or after the start date');
    }
  }

  private async notifyAdded(
    access: AccessContext,
    project: ProjectRow,
    userIds: string[],
  ): Promise<void> {
    await this.notifications.notify(
      userIds.map((userId) => ({
        userId,
        type: NotificationType.PROJECT_ADDED,
        title: `You were added to ${project.name}`,
        body: null,
        actorId: access.userId,
        organizationId: access.organizationId,
        resource: { type: 'project', id: project.id },
      })),
    );
  }

  private async afterChange(
    organizationId: string,
    projectId: string,
    extra: Record<string, unknown> = {},
  ) {
    await this.cache.bumpVersion(analyticsNamespace(organizationId));
    void this.realtime.publishToProject(RealtimeEvent.PROJECT_UPDATED, organizationId, projectId, {
      id: projectId,
      ...extra,
    });
  }
}
