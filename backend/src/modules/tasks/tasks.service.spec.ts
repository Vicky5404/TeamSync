import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccessResolver } from '../../common/authorization/access-resolver.service.js';
import type { AccessContext } from '../../common/auth/auth.types.js';
import { ApiException } from '../../common/errors/api-exception.js';
import { NotificationType, Role, TaskPriority, TaskStatus } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { CacheService } from '../../infrastructure/redis/cache.service.js';
import type { ActivityService } from '../activity/activity.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { LabelsService } from '../labels/labels.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeEvent } from '../realtime/realtime.events.js';
import type { RealtimePublisher } from '../realtime/realtime.publisher.js';

import type { TaskRow } from './task.mapper.js';
import { TasksService } from './tasks.service.js';
import type { TasksRepository } from './tasks.repository.js';

const ORG = 'org-1';
const PROJECT = 'project-1';
const TASK = 'task-1';
const ACTOR = 'user-actor';
const ASSIGNEE = 'user-assignee';
const REPORTER = 'user-reporter';

const access: AccessContext = {
  userId: ACTOR,
  organizationId: ORG,
  membershipId: 'membership-1',
  role: Role.MEMBER,
  projectId: PROJECT,
};

function row(overrides: Partial<TaskRow> = {}): TaskRow {
  const user = (id: string, name: string) => ({ id, name, email: `${id}@x.dev`, avatarUrl: null });
  return {
    id: TASK,
    organizationId: ORG,
    projectId: PROJECT,
    number: 7,
    title: 'Fix login',
    description: null,
    status: TaskStatus.TODO,
    priority: TaskPriority.MEDIUM,
    position: 1024,
    assigneeId: ASSIGNEE,
    reporterId: REPORTER,
    dueDate: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
    completedAt: null,
    deletedAt: null,
    project: { id: PROJECT, key: 'WEB', name: 'Website' },
    assignee: user(ASSIGNEE, 'Assignee'),
    reporter: user(REPORTER, 'Reporter'),
    labels: [],
    checklistItems: [],
    _count: { comments: 0, attachments: 0 },
    ...overrides,
  };
}

describe('TasksService', () => {
  const tx = {
    project: { update: vi.fn() },
    task: { create: vi.fn(), update: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    user: { findUnique: vi.fn() },
    task: { findMany: vi.fn() },
  };
  const tasks = {
    findRow: vi.fn(),
    nextPosition: vi.fn(),
    hasPositionCollision: vi.fn(),
    rebalanceColumn: vi.fn(),
    isOrganizationMember: vi.fn(),
  };
  const labels = { assertBelongToOrganization: vi.fn() };
  const activity = { record: vi.fn() };
  const notifications = { notify: vi.fn() };
  const realtime = { publishToProject: vi.fn() };
  const cache = { bumpVersion: vi.fn() };
  let service: TasksService;

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx));
    labels.assertBelongToOrganization.mockImplementation((_org: string, ids: string[]) =>
      Promise.resolve(ids),
    );
    tasks.isOrganizationMember.mockResolvedValue(true);
    tasks.nextPosition.mockResolvedValue(4096);
    realtime.publishToProject.mockResolvedValue(undefined);
    service = new TasksService(
      prisma as unknown as PrismaService,
      tasks as unknown as TasksRepository,
      labels as unknown as LabelsService,
      {} as AccessResolver,
      activity as unknown as ActivityService,
      {} as AuditService,
      notifications as unknown as NotificationsService,
      realtime as unknown as RealtimePublisher,
      cache as unknown as CacheService,
    );
  });

  describe('create', () => {
    beforeEach(() => {
      tx.project.update.mockResolvedValue({ taskSequence: 8, key: 'WEB' });
      tx.task.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          ...data,
          id: TASK,
          project: { key: 'WEB' },
          assignee: data.assigneeId ? { name: 'Assignee' } : null,
        }),
      );
      tasks.findRow.mockResolvedValue(row({ number: 8 }));
    });

    it('numbers the task from the project sequence and appends it to its column', async () => {
      const result = await service.create(access, {
        title: 'Fix login',
        status: TaskStatus.REVIEW,
      });

      expect(tx.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PROJECT, deletedAt: null },
          data: { taskSequence: { increment: 1 } },
        }),
      );
      const { data } = tx.task.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
      expect(data).toMatchObject({
        organizationId: ORG,
        projectId: PROJECT,
        number: 8,
        status: TaskStatus.REVIEW,
        priority: TaskPriority.MEDIUM,
        position: 4096,
        reporterId: ACTOR,
        assigneeId: null,
        completedAt: null,
      });
      expect(tasks.nextPosition).toHaveBeenCalledWith(PROJECT, TaskStatus.REVIEW, tx);
      expect(result.identifier).toBe('WEB-8');
    });

    it('records activity, notifies the assignee and broadcasts after commit', async () => {
      await service.create(access, { title: 'Fix login', assigneeId: ASSIGNEE });

      const entries = activity.record.mock.calls[0]?.[0] as Array<{ action: string }>;
      expect(entries.map((entry) => entry.action)).toEqual(['task.created', 'task.assigned']);
      expect(notifications.notify).toHaveBeenCalledWith([
        expect.objectContaining({
          userId: ASSIGNEE,
          type: NotificationType.TASK_ASSIGNED,
          actorId: ACTOR,
          organizationId: ORG,
          resource: { type: 'task', id: TASK, projectId: PROJECT },
        }),
      ]);
      expect(cache.bumpVersion).toHaveBeenCalledWith(expect.stringContaining(ORG));
      expect(realtime.publishToProject).toHaveBeenCalledWith(
        RealtimeEvent.TASK_CREATED,
        ORG,
        PROJECT,
        expect.objectContaining({ id: TASK }),
      );
    });

    it('marks tasks created as done as completed', async () => {
      await service.create(access, { title: 'Already done', status: TaskStatus.DONE });
      const { data } = tx.task.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
      expect(data.completedAt).toBeInstanceOf(Date);
    });

    it('refuses assignees from outside the organization before writing anything', async () => {
      tasks.isOrganizationMember.mockResolvedValue(false);
      await expect(
        service.create(access, { title: 'x', assigneeId: 'stranger' }),
      ).rejects.toBeInstanceOf(ApiException);
      expect(tasks.isOrganizationMember).toHaveBeenCalledWith(ORG, 'stranger');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('only accepts labels of the same organization', async () => {
      labels.assertBelongToOrganization.mockRejectedValue(new Error('foreign label'));
      await expect(service.create(access, { title: 'x', labelIds: ['label-9'] })).rejects.toThrow(
        'foreign label',
      );
      expect(labels.assertBelongToOrganization).toHaveBeenCalledWith(ORG, ['label-9']);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('requires a project scope', async () => {
      const { projectId: _projectId, ...withoutProject } = access;
      await expect(service.create(withoutProject, { title: 'x' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('move', () => {
    const taskAccess: AccessContext = { ...access, taskId: TASK };

    beforeEach(() => {
      tx.task.update.mockResolvedValue({ ...row(), status: TaskStatus.DONE });
      tasks.hasPositionCollision.mockResolvedValue(false);
    });

    it('moves within a column without activity or notifications', async () => {
      tasks.findRow.mockResolvedValue(row({ status: TaskStatus.TODO }));

      await service.move(taskAccess, { status: TaskStatus.TODO, position: 1536 });

      expect(tx.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TASK },
          data: { status: TaskStatus.TODO, position: 1536 },
        }),
      );
      expect(activity.record).not.toHaveBeenCalled();
      expect(notifications.notify).toHaveBeenCalledWith([]);
      expect(realtime.publishToProject).toHaveBeenCalledWith(
        RealtimeEvent.TASK_MOVED,
        ORG,
        PROJECT,
        expect.any(Object),
      );
    });

    it('completes a task moved to Done and tells the assignee and reporter', async () => {
      tasks.findRow.mockResolvedValue(row({ status: TaskStatus.REVIEW }));

      await service.move(taskAccess, { status: TaskStatus.DONE, position: 512 });

      const { data } = tx.task.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
      expect(data.completedAt).toBeInstanceOf(Date);
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'task.completed',
          metadata: { from: TaskStatus.REVIEW, to: TaskStatus.DONE },
        }),
        tx,
      );
      const intents = notifications.notify.mock.calls[0]?.[0] as Array<{
        userId: string;
        type: string;
      }>;
      expect(intents.map((intent) => intent.userId).sort()).toEqual([ASSIGNEE, REPORTER].sort());
      expect(intents.every((intent) => intent.type === NotificationType.TASK_STATUS_CHANGED)).toBe(
        true,
      );
    });

    it('reopens a task moved out of Done', async () => {
      tasks.findRow.mockResolvedValue(
        row({ status: TaskStatus.DONE, completedAt: new Date('2026-09-02T00:00:00Z') }),
      );
      await service.move(taskAccess, { status: TaskStatus.IN_PROGRESS, position: 100 });
      const { data } = tx.task.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
      expect(data.completedAt).toBeNull();
    });

    it('rebalances the column when positions collide and broadcasts the shifted tasks', async () => {
      tasks.findRow.mockResolvedValue(row({ status: TaskStatus.TODO }));
      tasks.hasPositionCollision.mockResolvedValue(true);
      tasks.rebalanceColumn.mockResolvedValue([TASK, 'task-2', 'task-3']);
      prisma.task.findMany.mockResolvedValue([
        row({ id: 'task-2', number: 8 }),
        row({ id: 'task-3', number: 9 }),
      ]);

      await service.move(taskAccess, { status: TaskStatus.TODO, position: 1024 });

      expect(tasks.rebalanceColumn).toHaveBeenCalledWith(PROJECT, TaskStatus.TODO, TASK, tx);
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['task-2', 'task-3'] } } }),
      );
      const updated = realtime.publishToProject.mock.calls.filter(
        ([event]) => event === RealtimeEvent.TASK_UPDATED,
      );
      expect(updated).toHaveLength(2);
    });

    it('returns 404 for tasks that are not in the caller’s organization', async () => {
      tasks.findRow.mockResolvedValue(null);
      await expect(
        service.move(taskAccess, { status: TaskStatus.TODO, position: 1 }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(tasks.findRow).toHaveBeenCalledWith(ORG, TASK);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
