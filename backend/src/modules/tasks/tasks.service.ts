import { Injectable } from '@nestjs/common';

import { AccessResolver } from '../../common/authorization/access-resolver.service.js';
import type { AccessContext } from '../../common/auth/auth.types.js';
import { Errors } from '../../common/errors/api-exception.js';
import { fromNullableISODate, toISODate } from '../../common/utils/dates.js';
import { type Paginated, paginated } from '../../common/utils/pagination.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { NotificationType, TaskPriority, TaskStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { NotificationIntent } from '../../infrastructure/queue/queue.constants.js';
import { CacheService } from '../../infrastructure/redis/cache.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { ActivityAction, type ActivityEntry, taskTarget } from '../activity/activity.types.js';
import { analyticsNamespace } from '../analytics/analytics-cache.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction, auditBase } from '../audit/audit.types.js';
import { LabelsService } from '../labels/labels.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeEvent, type RealtimeEventType } from '../realtime/realtime.events.js';
import { RealtimePublisher } from '../realtime/realtime.publisher.js';

import type {
  CreateTaskDto,
  MoveTaskDto,
  OrganizationTaskQueryDto,
  TaskDetailDto,
  TaskDto,
  TaskFiltersDto,
  UpdateTaskDto,
} from './dto/task.dto.js';
import { buildTaskWhere } from './task-filters.js';
import {
  taskIdentifier,
  taskInclude,
  type TaskRow,
  toTaskDetailDto,
  toTaskDto,
} from './task.mapper.js';
import { TasksRepository } from './tasks.repository.js';

/** Upper bound on per-task realtime events emitted after a column rebalance. */
const MAX_REBALANCE_EVENTS = 200;

const statusLabel = (status: TaskStatus) => status.replace('_', ' ').toLowerCase();

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksRepository,
    private readonly labels: LabelsService,
    private readonly access: AccessResolver,
    private readonly activity: ActivityService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimePublisher,
    private readonly cache: CacheService,
  ) {}

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  async listForProject(access: AccessContext, filters: TaskFiltersDto): Promise<TaskDto[]> {
    const projectId = requireProjectId(access);
    const rows = await this.tasks.listForProject(projectId, buildTaskWhere(filters, access.userId));
    return rows.map(toTaskDto);
  }

  async listForOrganization(
    access: AccessContext,
    query: OrganizationTaskQueryDto,
  ): Promise<Paginated<TaskDto>> {
    const where: Prisma.TaskWhereInput = {
      ...buildTaskWhere(query, access.userId),
      ...(query.projectId ? { projectId: query.projectId } : {}),
    };
    const { rows, total, window } = await this.tasks.listForOrganization(
      access.organizationId,
      where,
      {
        ...(query.sort ? { field: query.sort } : {}),
        ...(query.order ? { order: query.order } : {}),
      },
      query.page,
      query.pageSize,
    );
    return paginated(rows.map(toTaskDto), total, window);
  }

  async get(access: AccessContext): Promise<TaskDetailDto> {
    return toTaskDetailDto(await this.requireDetail(access));
  }

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  async create(access: AccessContext, input: CreateTaskDto): Promise<TaskDto> {
    const projectId = requireProjectId(access);
    const assigneeId = input.assigneeId ?? null;
    if (assigneeId) await this.assertAssignable(access.organizationId, assigneeId);
    const labelIds = await this.labels.assertBelongToOrganization(
      access.organizationId,
      input.labelIds ?? [],
    );
    const status = input.status ?? TaskStatus.TODO;

    const task = await this.prisma.$transaction(async (tx) => {
      // Row-locks the project, serializing task numbers within it (404 if it
      // was moved to the trash meanwhile).
      const project = await tx.project.update({
        where: { id: projectId, deletedAt: null },
        data: { taskSequence: { increment: 1 } },
        select: { taskSequence: true, key: true },
      });
      const created = await tx.task.create({
        data: {
          organizationId: access.organizationId,
          projectId,
          number: project.taskSequence,
          title: input.title,
          description: input.description ?? null,
          status,
          priority: input.priority ?? TaskPriority.MEDIUM,
          position: await this.tasks.nextPosition(projectId, status, tx),
          assigneeId,
          reporterId: access.userId,
          dueDate: fromNullableISODate(input.dueDate) ?? null,
          completedAt: status === TaskStatus.DONE ? new Date() : null,
          labels: { create: labelIds.map((labelId) => ({ labelId })) },
        },
        include: { project: { select: { key: true } }, assignee: { select: { name: true } } },
      });
      const target = taskTarget(created);
      const entries: ActivityEntry[] = [
        {
          ...this.base(access, created.projectId, created.id),
          action: ActivityAction.TASK_CREATED,
          target,
        },
      ];
      if (created.assignee) {
        entries.push({
          ...this.base(access, created.projectId, created.id),
          action: ActivityAction.TASK_ASSIGNED,
          target,
          metadata: { assignee: created.assignee.name },
        });
      }
      await this.activity.record(entries, tx);
      return created;
    });

    const intents: NotificationIntent[] = assigneeId
      ? [this.assignedIntent(access, { ...task, identifier: taskIdentifier(task) }, assigneeId)]
      : [];
    const row = await this.afterChange(access, task.id, RealtimeEvent.TASK_CREATED, intents);
    return toTaskDto(row);
  }

  /** Partial update of any task field; records one activity entry per meaningful change. */
  async update(access: AccessContext, input: UpdateTaskDto): Promise<TaskDetailDto> {
    const current = await this.requireRow(access);
    const assigneeId = input.assigneeId === undefined ? undefined : (input.assigneeId ?? null);
    if (assigneeId) await this.assertAssignable(access.organizationId, assigneeId);
    const labelIds =
      input.labelIds === undefined
        ? undefined
        : await this.labels.assertBelongToOrganization(access.organizationId, input.labelIds);

    const currentLabelIds = current.labels.map(({ label }) => label.id).sort();
    const changed = {
      title: input.title !== undefined && input.title !== current.title,
      description:
        input.description !== undefined && (input.description ?? null) !== current.description,
      priority: input.priority !== undefined && input.priority !== current.priority,
      dueDate:
        input.dueDate !== undefined && (input.dueDate ?? null) !== toISODate(current.dueDate),
      labels: labelIds !== undefined && [...labelIds].sort().join() !== currentLabelIds.join(),
      assignee: assigneeId !== undefined && assigneeId !== current.assigneeId,
      status: input.status !== undefined && input.status !== current.status,
    };
    if (!Object.values(changed).some(Boolean)) return this.get(access);

    const newAssignee =
      changed.assignee && assigneeId
        ? await this.prisma.user.findUnique({ where: { id: assigneeId }, select: { name: true } })
        : null;

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.TaskUncheckedUpdateInput = { updatedAt: new Date() };
      if (changed.title) data.title = input.title;
      if (changed.description) data.description = input.description ?? null;
      if (changed.priority) data.priority = input.priority;
      if (changed.dueDate) data.dueDate = fromNullableISODate(input.dueDate) ?? null;
      if (changed.assignee) data.assigneeId = assigneeId ?? null;
      if (changed.status && input.status) {
        data.status = input.status;
        // A status change from the details view appends the task to the new column.
        data.position = await this.tasks.nextPosition(current.projectId, input.status, tx);
        data.completedAt = input.status === TaskStatus.DONE ? new Date() : null;
      }
      const updated = await tx.task.update({
        where: { id: current.id },
        data,
        include: { project: { select: { key: true } } },
      });
      if (changed.labels && labelIds) {
        await tx.taskLabel.deleteMany({ where: { taskId: current.id } });
        await tx.taskLabel.createMany({
          data: labelIds.map((labelId) => ({
            taskId: current.id,
            labelId,
            organizationId: access.organizationId,
          })),
        });
      }

      const target = taskTarget(updated);
      const base = this.base(access, current.projectId, current.id);
      const entries: ActivityEntry[] = [];
      if (changed.priority && input.priority) {
        entries.push({
          ...base,
          action: ActivityAction.TASK_UPDATED,
          target,
          metadata: { field: 'priority', to: input.priority },
        });
      }
      for (const field of ['title', 'description', 'dueDate', 'labels'] as const) {
        if (changed[field]) {
          entries.push({
            ...base,
            action: ActivityAction.TASK_UPDATED,
            target,
            metadata: { field: field === 'dueDate' ? 'due date' : field },
          });
        }
      }
      if (changed.assignee) {
        entries.push({
          ...base,
          action: ActivityAction.TASK_ASSIGNED,
          target,
          metadata: { assignee: newAssignee?.name ?? null },
        });
      }
      if (changed.status && input.status)
        entries.push(this.statusEntry(base, target, current.status, input.status));
      await this.activity.record(entries, tx);
    });

    const intents: NotificationIntent[] = [];
    const identifier = taskIdentifier(current);
    if (changed.assignee && assigneeId) {
      intents.push(
        this.assignedIntent(
          access,
          { ...current, title: input.title ?? current.title, identifier },
          assigneeId,
        ),
      );
    }
    if (changed.status && input.status) {
      intents.push(
        ...this.statusIntents(
          access,
          current,
          identifier,
          input.status,
          assigneeId === undefined ? current.assigneeId : assigneeId,
        ),
      );
    }
    await this.afterChange(access, current.id, RealtimeEvent.TASK_UPDATED, intents);
    return this.get(access);
  }

  /** Kanban drag & drop: change column and/or fractional position. */
  async move(access: AccessContext, input: MoveTaskDto): Promise<TaskDto> {
    const current = await this.requireRow(access);
    const statusChanged = input.status !== current.status;
    let rebalanced: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: current.id },
        data: {
          status: input.status,
          position: input.position,
          ...(statusChanged
            ? { completedAt: input.status === TaskStatus.DONE ? new Date() : null }
            : {}),
        },
        include: { project: { select: { key: true } } },
      });
      if (
        await this.tasks.hasPositionCollision(
          current.projectId,
          input.status,
          current.id,
          input.position,
          tx,
        )
      ) {
        rebalanced = await this.tasks.rebalanceColumn(
          current.projectId,
          input.status,
          current.id,
          tx,
        );
      }
      if (statusChanged) {
        await this.activity.record(
          this.statusEntry(
            this.base(access, current.projectId, current.id),
            taskTarget(updated),
            current.status,
            input.status,
          ),
          tx,
        );
      }
    });

    const intents = statusChanged
      ? this.statusIntents(
          access,
          current,
          taskIdentifier(current),
          input.status,
          current.assigneeId,
        )
      : [];
    const row = await this.afterChange(access, current.id, RealtimeEvent.TASK_MOVED, intents);

    const others = rebalanced.filter((id) => id !== current.id).slice(0, MAX_REBALANCE_EVENTS);
    if (others.length > 0) {
      const rows = await this.prisma.task.findMany({
        where: { id: { in: others } },
        include: taskInclude,
      });
      for (const other of rows) {
        void this.realtime.publishToProject(
          RealtimeEvent.TASK_UPDATED,
          access.organizationId,
          other.projectId,
          toTaskDto(other),
        );
      }
    }
    return toTaskDto(row);
  }

  /**
   * Move a task to the trash. It disappears everywhere immediately and can be
   * restored until the maintenance job purges it (with its stored files).
   */
  async delete(access: AccessContext): Promise<void> {
    const current = await this.requireRow(access);
    const identifier = taskIdentifier(current);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.task.updateMany({
        where: { id: current.id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (count === 0) throw Errors.notFound('Task');
      await this.activity.record(
        {
          ...this.base(access, current.projectId, null),
          action: ActivityAction.TASK_DELETED,
          target: { type: 'project', id: current.projectId, name: current.project.name },
          metadata: { identifier, title: current.title },
        },
        tx,
      );
      await this.audit.record(
        {
          ...auditBase(access),
          action: AuditAction.TASK_DELETED,
          entityType: 'task',
          entityId: current.id,
          metadata: { identifier, title: current.title },
        },
        tx,
      );
    });
    await this.access.forgetTasks(current.id);
    await this.cache.bumpVersion(analyticsNamespace(access.organizationId));
    void this.realtime.publishToProject(
      RealtimeEvent.TASK_DELETED,
      access.organizationId,
      current.projectId,
      {
        id: current.id,
        projectId: current.projectId,
      },
    );
  }

  /** Take a task out of the trash; it is appended to the end of its column. */
  async restore(access: AccessContext): Promise<TaskDto> {
    if (!access.taskId) throw Errors.notFound('Task');
    const task = await this.prisma.task.findFirst({
      where: { id: access.taskId, organizationId: access.organizationId },
      select: {
        id: true,
        title: true,
        number: true,
        status: true,
        projectId: true,
        deletedAt: true,
        project: { select: { key: true, deletedAt: true } },
      },
    });
    if (!task) throw Errors.notFound('Task');
    if (task.project.deletedAt) {
      throw Errors.conflict('This task’s project is in the trash. Restore the project instead.');
    }

    if (task.deletedAt) {
      await this.prisma.$transaction(async (tx) => {
        const position = await this.tasks.nextPosition(task.projectId, task.status, tx);
        const { count } = await tx.task.updateMany({
          where: { id: task.id, deletedAt: { not: null } },
          data: { deletedAt: null, position },
        });
        if (count === 0) return; // restored concurrently
        await this.activity.record(
          {
            ...this.base(access, task.projectId, task.id),
            action: ActivityAction.TASK_RESTORED,
            target: taskTarget(task),
          },
          tx,
        );
        await this.audit.record(
          {
            ...auditBase(access),
            action: AuditAction.TASK_RESTORED,
            entityType: 'task',
            entityId: task.id,
            metadata: { identifier: taskIdentifier(task), title: task.title },
          },
          tx,
        );
      });
    }
    // Boards add restored tasks the same way as new ones.
    const row = await this.afterChange(access, task.id, RealtimeEvent.TASK_CREATED, []);
    return toTaskDto(row);
  }

  async addLabels(access: AccessContext, labelIds: string[]): Promise<TaskDetailDto> {
    const current = await this.requireRow(access);
    const valid = await this.labels.assertBelongToOrganization(access.organizationId, labelIds);
    const added = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.taskLabel.createMany({
        data: valid.map((labelId) => ({
          taskId: current.id,
          labelId,
          organizationId: access.organizationId,
        })),
        skipDuplicates: true,
      });
      if (count > 0) await this.recordLabelChange(access, current, tx);
      return count;
    });
    if (added > 0) await this.afterChange(access, current.id, RealtimeEvent.TASK_UPDATED, []);
    return this.get(access);
  }

  async removeLabel(access: AccessContext, labelId: string): Promise<TaskDetailDto> {
    const current = await this.requireRow(access);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.taskLabel.deleteMany({ where: { taskId: current.id, labelId } });
      if (count === 0) throw Errors.notFound('Label');
      await this.recordLabelChange(access, current, tx);
    });
    await this.afterChange(access, current.id, RealtimeEvent.TASK_UPDATED, []);
    return this.get(access);
  }

  /** Mark a task as updated after a change to something it contains (checklist) and broadcast it. */
  async touch(access: AccessContext, taskId: string): Promise<void> {
    await this.prisma.task.update({ where: { id: taskId }, data: { updatedAt: new Date() } });
    await this.afterChange(access, taskId, RealtimeEvent.TASK_UPDATED, []);
  }

  /** Broadcast fresh derived fields (comment/attachment counts) without changing `updatedAt`. */
  async republish(organizationId: string, taskId: string): Promise<void> {
    const row = await this.tasks.findRow(organizationId, taskId);
    if (row)
      void this.realtime.publishToProject(
        RealtimeEvent.TASK_UPDATED,
        organizationId,
        row.projectId,
        toTaskDto(row),
      );
  }

  // -------------------------------------------------------------------------

  private async requireRow(access: AccessContext): Promise<TaskRow> {
    if (!access.taskId) throw Errors.notFound('Task');
    const task = await this.tasks.findRow(access.organizationId, access.taskId);
    if (!task) throw Errors.notFound('Task');
    return task;
  }

  private async requireDetail(access: AccessContext) {
    if (!access.taskId) throw Errors.notFound('Task');
    const task = await this.tasks.findDetail(access.organizationId, access.taskId);
    if (!task) throw Errors.notFound('Task');
    return task;
  }

  private async assertAssignable(organizationId: string, userId: string): Promise<void> {
    if (!(await this.tasks.isOrganizationMember(organizationId, userId))) {
      throw Errors.field('assigneeId', 'Assignee must be a member of the organization');
    }
  }

  private base(access: AccessContext, projectId: string, taskId: string | null) {
    return { organizationId: access.organizationId, projectId, taskId, actorId: access.userId };
  }

  private statusEntry(
    base: ReturnType<TasksService['base']>,
    target: ActivityEntry['target'],
    from: TaskStatus,
    to: TaskStatus,
  ): ActivityEntry {
    return {
      ...base,
      action:
        to === TaskStatus.DONE ? ActivityAction.TASK_COMPLETED : ActivityAction.TASK_STATUS_CHANGED,
      target,
      metadata: { from, to },
    };
  }

  private async recordLabelChange(
    access: AccessContext,
    task: TaskRow,
    tx: Prisma.TransactionClient,
  ) {
    await tx.task.update({ where: { id: task.id }, data: { updatedAt: new Date() } });
    await this.activity.record(
      {
        ...this.base(access, task.projectId, task.id),
        action: ActivityAction.TASK_UPDATED,
        target: taskTarget(task),
        metadata: { field: 'labels' },
      },
      tx,
    );
  }

  private assignedIntent(
    access: AccessContext,
    task: { id: string; title: string; projectId: string; identifier: string },
    assigneeId: string,
  ): NotificationIntent {
    return {
      userId: assigneeId,
      type: NotificationType.TASK_ASSIGNED,
      title: `You were assigned ${task.identifier}`,
      body: task.title,
      actorId: access.userId,
      organizationId: access.organizationId,
      resource: { type: 'task', id: task.id, projectId: task.projectId },
    };
  }

  /** Assignee and reporter hear about status changes (never the actor — filtered on dispatch). */
  private statusIntents(
    access: AccessContext,
    task: TaskRow,
    identifier: string,
    status: TaskStatus,
    assigneeId: string | null,
  ): NotificationIntent[] {
    const watchers = new Set(
      [assigneeId, task.reporterId].filter((id): id is string => Boolean(id)),
    );
    return [...watchers].map((userId) => ({
      userId,
      type: NotificationType.TASK_STATUS_CHANGED,
      title: `${identifier} moved to ${statusLabel(status)}`,
      body: task.title,
      actorId: access.userId,
      organizationId: access.organizationId,
      resource: { type: 'task', id: task.id, projectId: task.projectId },
    }));
  }

  /** After commit: notify, invalidate analytics, broadcast the fresh task. */
  private async afterChange(
    access: AccessContext,
    taskId: string,
    event: RealtimeEventType,
    intents: NotificationIntent[],
  ): Promise<TaskRow> {
    const row = await this.tasks.findRow(access.organizationId, taskId);
    if (!row) throw Errors.notFound('Task');
    await this.notifications.notify(intents);
    await this.cache.bumpVersion(analyticsNamespace(access.organizationId));
    void this.realtime.publishToProject(
      event,
      access.organizationId,
      row.projectId,
      toTaskDto(row),
    );
    return row;
  }
}

function requireProjectId(access: AccessContext): string {
  if (!access.projectId) throw Errors.notFound('Project');
  return access.projectId;
}
