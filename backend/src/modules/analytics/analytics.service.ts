import { Injectable } from '@nestjs/common';

import type { AccessContext } from '../../common/auth/auth.types.js';
import {
  toUserSummary,
  type UserSummaryDto,
  type UserSummaryRow,
  userSummarySelect,
} from '../../common/dto/user-summary.dto.js';
import { Errors } from '../../common/errors/api-exception.js';
import { addDays, DAY_MS, startOfTodayUTC, toISODate } from '../../common/utils/dates.js';
import { ProjectStatus, TaskPriority, TaskStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { CacheService } from '../../infrastructure/redis/cache.service.js';
import { projectTaskStats, progressOf } from '../projects/project-stats.js';

import { ANALYTICS_CACHE_TTL_SECONDS, analyticsNamespace } from './analytics-cache.js';
import { AnalyticsRepository, type Scope } from './analytics.repository.js';
import type {
  ActivityMetricsDto,
  CompletionPointDto,
  CompletionRange,
  CompletionRateDto,
  DashboardSummaryDto,
  OverdueReportDto,
  ProjectAnalyticsDto,
  ProjectProgressEntryDto,
  TaskStatisticsDto,
  WorkloadEntryDto,
} from './dto/analytics.dto.js';

const OPEN_STATUSES = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW];
const PROJECT_STATUS_ORDER: Record<ProjectStatus, number> = {
  ACTIVE: 0,
  PLANNING: 1,
  ON_HOLD: 2,
  COMPLETED: 3,
  ARCHIVED: 4,
};

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: AnalyticsRepository,
    private readonly cache: CacheService,
  ) {}

  // -------------------------------------------------------------------------
  // Web client dashboard
  // -------------------------------------------------------------------------

  async dashboard(access: AccessContext): Promise<DashboardSummaryDto> {
    const { organizationId } = access;
    const shared = await this.cached(organizationId, 'dashboard', async () => {
      const today = startOfTodayUTC();
      const [totalProjects, activeProjects, totalTasks, completedTasks, overdueTasks, dueThisWeek] =
        await Promise.all([
          this.prisma.project.count({ where: { organizationId, deletedAt: null } }),
          this.prisma.project.count({
            where: { organizationId, deletedAt: null, status: ProjectStatus.ACTIVE },
          }),
          this.prisma.task.count({ where: { organizationId, deletedAt: null } }),
          this.prisma.task.count({
            where: { organizationId, deletedAt: null, status: TaskStatus.DONE },
          }),
          this.prisma.task.count({
            where: {
              organizationId,
              deletedAt: null,
              status: { not: TaskStatus.DONE },
              dueDate: { lt: today },
            },
          }),
          this.prisma.task.count({
            where: {
              organizationId,
              deletedAt: null,
              status: { not: TaskStatus.DONE },
              dueDate: { gte: today, lte: addDays(today, 7) },
            },
          }),
        ]);
      return {
        totalProjects,
        activeProjects,
        totalTasks,
        completedTasks,
        overdueTasks,
        dueThisWeek,
      };
    });
    // Per-user figure is computed live so the shared cache entry stays user-agnostic.
    const assignedToMe = await this.prisma.task.count({
      where: {
        organizationId,
        deletedAt: null,
        assigneeId: access.userId,
        status: { not: TaskStatus.DONE },
      },
    });
    return { ...shared, assignedToMe };
  }

  taskCompletion(
    organizationId: string,
    days: CompletionRange = 30,
  ): Promise<CompletionPointDto[]> {
    return this.cached(organizationId, `completion:${days}`, () =>
      this.completionSeries({ organizationId }, days),
    );
  }

  workload(organizationId: string): Promise<WorkloadEntryDto[]> {
    return this.cached(organizationId, 'workload', async () => {
      const members = await this.prisma.membership.findMany({
        where: { organizationId },
        select: { user: { select: userSummarySelect } },
      });
      return this.workloadFor(
        { organizationId },
        members.map((member) => member.user),
      );
    });
  }

  projectProgress(organizationId: string): Promise<ProjectProgressEntryDto[]> {
    return this.cached(organizationId, 'project-progress', async () => {
      const projects = await this.prisma.project.findMany({
        where: { organizationId, deletedAt: null, status: { not: ProjectStatus.ARCHIVED } },
        select: { id: true, name: true, key: true, status: true, dueDate: true },
      });
      const stats = await projectTaskStats(
        this.prisma,
        projects.map((project) => project.id),
      );
      return projects
        .sort(
          (a, b) =>
            PROJECT_STATUS_ORDER[a.status] - PROJECT_STATUS_ORDER[b.status] ||
            (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity),
        )
        .map((project) => {
          const entry = stats.get(project.id);
          return {
            id: project.id,
            name: project.name,
            key: project.key,
            status: project.status,
            progress: entry?.progress ?? 0,
            dueDate: toISODate(project.dueDate),
            totalTasks: entry?.total ?? 0,
            completedTasks: entry?.completed ?? 0,
          };
        });
    });
  }

  project(access: AccessContext): Promise<ProjectAnalyticsDto> {
    const projectId = access.projectId;
    if (!projectId) throw Errors.notFound('Project');
    return this.cached(access.organizationId, `project:${projectId}`, async () => {
      const scope: Scope = { organizationId: access.organizationId, projectId };
      const [breakdown, completionTrend, members] = await Promise.all([
        this.breakdown(scope),
        this.completionSeries(scope, 30),
        this.prisma.projectMember.findMany({
          where: { projectId },
          select: { user: { select: userSummarySelect } },
        }),
      ]);
      return {
        byStatus: breakdown.byStatus,
        byPriority: breakdown.byPriority,
        completionTrend,
        workload: await this.workloadFor(
          scope,
          members.map((member) => member.user),
        ),
        summary: {
          total: breakdown.total,
          completed: breakdown.completed,
          overdue: breakdown.overdue,
          averageCycleTimeDays: breakdown.averageCycleTimeDays,
        },
      };
    });
  }

  // -------------------------------------------------------------------------
  // Additional analytics
  // -------------------------------------------------------------------------

  taskStatistics(organizationId: string): Promise<TaskStatisticsDto> {
    return this.cached(organizationId, 'task-statistics', async () => {
      const [breakdown, unassigned] = await Promise.all([
        this.breakdown({ organizationId }),
        this.prisma.task.count({
          where: {
            organizationId,
            deletedAt: null,
            assigneeId: null,
            status: { not: TaskStatus.DONE },
          },
        }),
      ]);
      return {
        ...breakdown,
        completionRate: progressOf(breakdown.completed, breakdown.total),
        unassigned,
      };
    });
  }

  completionRate(organizationId: string, days: CompletionRange = 30): Promise<CompletionRateDto> {
    return this.cached(organizationId, `completion-rate:${days}`, async () => {
      const now = new Date();
      const from = new Date(now.getTime() - days * DAY_MS);
      const previousFrom = new Date(from.getTime() - days * DAY_MS);
      const [created, completed, previousCompleted] = await Promise.all([
        this.prisma.task.count({
          where: { organizationId, deletedAt: null, createdAt: { gte: from } },
        }),
        this.prisma.task.count({
          where: {
            organizationId,
            deletedAt: null,
            status: TaskStatus.DONE,
            completedAt: { gte: from },
          },
        }),
        this.prisma.task.count({
          where: {
            organizationId,
            deletedAt: null,
            status: TaskStatus.DONE,
            completedAt: { gte: previousFrom, lt: from },
          },
        }),
      ]);
      return {
        days,
        created,
        completed,
        completionRate: Math.min(100, progressOf(completed, created)),
        previousCompleted,
      };
    });
  }

  overdue(organizationId: string): Promise<OverdueReportDto> {
    return this.cached(organizationId, 'overdue', async () => {
      const today = startOfTodayUTC();
      const where = {
        organizationId,
        deletedAt: null,
        status: { not: TaskStatus.DONE },
        dueDate: { lt: today },
      } as const;
      const [total, byProject, byAssignee, mostOverdue] = await Promise.all([
        this.prisma.task.count({ where }),
        this.prisma.task.groupBy({ by: ['projectId'], where, _count: { _all: true } }),
        this.prisma.task.groupBy({ by: ['assigneeId'], where, _count: { _all: true } }),
        this.prisma.task.findMany({
          where,
          orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
          take: 20,
          select: {
            id: true,
            number: true,
            title: true,
            projectId: true,
            dueDate: true,
            priority: true,
            project: { select: { key: true } },
            assignee: { select: userSummarySelect },
          },
        }),
      ]);
      const [projects, users] = await Promise.all([
        this.prisma.project.findMany({
          where: { id: { in: byProject.map((row) => row.projectId) } },
          select: { id: true, name: true, key: true },
        }),
        this.prisma.user.findMany({
          where: {
            id: {
              in: byAssignee.map((row) => row.assigneeId).filter((id): id is string => id !== null),
            },
          },
          select: userSummarySelect,
        }),
      ]);
      const projectById = new Map(projects.map((project) => [project.id, project]));
      const userById = new Map(users.map((user) => [user.id, user]));
      return {
        total,
        byProject: byProject
          .map((row) => {
            const project = projectById.get(row.projectId);
            return {
              projectId: row.projectId,
              name: project?.name ?? '',
              key: project?.key ?? '',
              count: row._count._all,
            };
          })
          .sort((a, b) => b.count - a.count),
        byAssignee: byAssignee
          .map((row) => ({
            member: row.assigneeId
              ? toUserSummary(userById.get(row.assigneeId) ?? null, row.assigneeId)
              : null,
            count: row._count._all,
          }))
          .sort((a, b) => b.count - a.count),
        mostOverdue: mostOverdue.map((task) => ({
          id: task.id,
          identifier: `${task.project.key}-${task.number}`,
          title: task.title,
          projectId: task.projectId,
          dueDate: toISODate(task.dueDate) ?? '',
          daysOverdue: task.dueDate
            ? Math.round((today.getTime() - task.dueDate.getTime()) / DAY_MS)
            : 0,
          priority: task.priority,
          assignee: task.assignee ? toUserSummary(task.assignee) : null,
        })),
      };
    });
  }

  activityMetrics(organizationId: string, days: CompletionRange = 30): Promise<ActivityMetricsDto> {
    return this.cached(organizationId, `activity:${days}`, async () => {
      const from = addDays(startOfTodayUTC(), -(days - 1));
      const where = { organizationId, createdAt: { gte: from } };
      const [perDay, byAction, byActor] = await Promise.all([
        this.repository.activityPerDay(organizationId, from),
        this.prisma.activity.groupBy({ by: ['action'], where, _count: { _all: true } }),
        this.prisma.activity.groupBy({
          by: ['actorId'],
          where: { ...where, actorId: { not: null } },
          _count: { _all: true },
          orderBy: { _count: { actorId: 'desc' } },
          take: 10,
        }),
      ]);
      const actors = await this.prisma.user.findMany({
        where: {
          id: { in: byActor.map((row) => row.actorId).filter((id): id is string => id !== null) },
        },
        select: userSummarySelect,
      });
      const actorById = new Map(actors.map((actor) => [actor.id, actor]));
      const byDay = this.fillDays(from, days, new Map(perDay.map((row) => [row.date, row.count])));
      return {
        days,
        total: byDay.reduce((sum, day) => sum + day.count, 0),
        byDay,
        byAction: byAction
          .map((row) => ({ action: row.action, count: row._count._all }))
          .sort((a, b) => b.count - a.count),
        topContributors: byActor.map((row) => ({
          member: toUserSummary(actorById.get(row.actorId ?? '') ?? null, row.actorId ?? ''),
          count: row._count._all,
        })),
      };
    });
  }

  // -------------------------------------------------------------------------

  private async breakdown(scope: Scope) {
    const where = scope.projectId
      ? { projectId: scope.projectId, deletedAt: null }
      : { organizationId: scope.organizationId, deletedAt: null };
    const today = startOfTodayUTC();
    const [byStatusRows, byPriorityRows, overdue, cycle] = await Promise.all([
      this.prisma.task.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['priority'], where, _count: { _all: true } }),
      this.prisma.task.count({
        where: { ...where, status: { not: TaskStatus.DONE }, dueDate: { lt: today } },
      }),
      this.repository.averageCycleTimeDays(scope),
    ]);
    const byStatus = Object.values(TaskStatus).map((status) => ({
      status,
      count: byStatusRows.find((row) => row.status === status)?._count._all ?? 0,
    }));
    const byPriority = Object.values(TaskPriority).map((priority) => ({
      priority,
      count: byPriorityRows.find((row) => row.priority === priority)?._count._all ?? 0,
    }));
    const total = byStatus.reduce((sum, row) => sum + row.count, 0);
    const completed = byStatus.find((row) => row.status === TaskStatus.DONE)?.count ?? 0;
    return {
      byStatus,
      byPriority,
      total,
      completed,
      overdue,
      averageCycleTimeDays:
        cycle.samples >= 2 && cycle.days !== null ? Math.round(cycle.days * 10) / 10 : null,
    };
  }

  private async completionSeries(scope: Scope, days: number): Promise<CompletionPointDto[]> {
    const from = addDays(startOfTodayUTC(), -(days - 1));
    const [created, completed] = await Promise.all([
      this.repository.createdPerDay(scope, from),
      this.repository.completedPerDay(scope, from),
    ]);
    const createdByDay = new Map(created.map((row) => [row.date, row.count]));
    const completedByDay = new Map(completed.map((row) => [row.date, row.count]));
    return this.fillDays(from, days, createdByDay).map(({ date, count }) => ({
      date,
      created: count,
      completed: completedByDay.get(date) ?? 0,
    }));
  }

  private async workloadFor(scope: Scope, users: UserSummaryRow[]): Promise<WorkloadEntryDto[]> {
    if (users.length === 0) return [];
    const rows = await this.prisma.task.groupBy({
      by: ['assigneeId', 'status'],
      where: {
        ...(scope.projectId
          ? { projectId: scope.projectId }
          : { organizationId: scope.organizationId }),
        deletedAt: null,
        assigneeId: { in: users.map((user) => user.id) },
        status: { in: OPEN_STATUSES },
      },
      _count: { _all: true },
    });
    const count = (userId: string, status: TaskStatus) =>
      rows.find((row) => row.assigneeId === userId && row.status === status)?._count._all ?? 0;
    return users
      .map((user) => ({
        member: toUserSummary(user) satisfies UserSummaryDto,
        todo: count(user.id, TaskStatus.TODO),
        inProgress: count(user.id, TaskStatus.IN_PROGRESS),
        review: count(user.id, TaskStatus.REVIEW),
      }))
      .filter((entry) => entry.todo + entry.inProgress + entry.review > 0)
      .sort((a, b) => b.todo + b.inProgress + b.review - (a.todo + a.inProgress + a.review));
  }

  private fillDays(
    from: Date,
    days: number,
    counts: Map<string, number>,
  ): Array<{ date: string; count: number }> {
    return Array.from({ length: days }, (_, index) => {
      const date = toISODate(addDays(from, index));
      return { date, count: counts.get(date) ?? 0 };
    });
  }

  /** Versioned read-through cache; any write in the organization bumps the version. */
  private async cached<T>(
    organizationId: string,
    name: string,
    load: () => Promise<T>,
  ): Promise<T> {
    const namespace = analyticsNamespace(organizationId);
    const version = await this.cache.version(namespace);
    if (version < 0) return load(); // cache unavailable
    return this.cache.wrap(`${namespace}:v${version}:${name}`, ANALYTICS_CACHE_TTL_SECONDS, load);
  }
}
