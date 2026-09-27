import { Injectable } from '@nestjs/common';

import { type PageWindow, pageWindow } from '../../common/utils/pagination.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { TaskStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

import type { TaskSortField } from './dto/task.dto.js';
import { buildTaskOrderBy } from './task-filters.js';
import { taskDetailInclude, type TaskDetailRow, taskInclude, type TaskRow } from './task.mapper.js';

type Db = PrismaService | Prisma.TransactionClient;

/** Gap between consecutive positions when appending or rebalancing a column. */
export const POSITION_STEP = 1024;
/** Positions closer than this are considered colliding (float precision exhausted). */
const POSITION_EPSILON = 1e-6;
/** Safety cap for project board queries, which return every matching task. */
const BOARD_LIMIT = 5_000;

/** Live (not soft-deleted) tasks. Every read path filters on this. */
export const LIVE = { deletedAt: null } as const;

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  findRow(organizationId: string, taskId: string, db: Db = this.prisma): Promise<TaskRow | null> {
    return db.task.findFirst({
      where: { id: taskId, organizationId, ...LIVE },
      include: taskInclude,
    });
  }

  findDetail(
    organizationId: string,
    taskId: string,
    db: Db = this.prisma,
  ): Promise<TaskDetailRow | null> {
    return db.task.findFirst({
      where: { id: taskId, organizationId, ...LIVE },
      include: taskDetailInclude,
    });
  }

  listForProject(projectId: string, where: Prisma.TaskWhereInput): Promise<TaskRow[]> {
    return this.prisma.task.findMany({
      where: { projectId, ...LIVE, ...where },
      include: taskInclude,
      orderBy: [{ status: 'asc' }, { position: 'asc' }, { id: 'asc' }],
      take: BOARD_LIMIT,
    });
  }

  async listForOrganization(
    organizationId: string,
    where: Prisma.TaskWhereInput,
    sort: { field?: TaskSortField; order?: 'asc' | 'desc' },
    page?: number,
    pageSize?: number,
  ): Promise<{ rows: TaskRow[]; total: number; window: PageWindow }> {
    const scoped: Prisma.TaskWhereInput = { organizationId, ...LIVE, ...where };
    const total = await this.prisma.task.count({ where: scoped });
    const window = pageWindow(total, page, pageSize);
    const rows = await this.prisma.task.findMany({
      where: scoped,
      include: taskInclude,
      orderBy: buildTaskOrderBy(sort.field, sort.order),
      skip: window.skip,
      take: window.take,
    });
    return { rows, total, window };
  }

  /** Position that appends to the end of a status column. */
  async nextPosition(projectId: string, status: TaskStatus, db: Db = this.prisma): Promise<number> {
    const result = await db.task.aggregate({
      where: { projectId, status, ...LIVE },
      _max: { position: true },
    });
    return (result._max.position ?? 0) + POSITION_STEP;
  }

  /** Whether another task in the column sits at (practically) the same position. */
  async hasPositionCollision(
    projectId: string,
    status: TaskStatus,
    taskId: string,
    position: number,
    db: Db = this.prisma,
  ): Promise<boolean> {
    const count = await db.task.count({
      where: {
        projectId,
        status,
        ...LIVE,
        id: { not: taskId },
        position: { gte: position - POSITION_EPSILON, lte: position + POSITION_EPSILON },
      },
    });
    return count > 0;
  }

  /**
   * Re-space a column to multiples of POSITION_STEP, preserving order (the moved
   * task wins ties so it lands where the user dropped it). One statement, no
   * matter how long the column is. Returns the ids whose position changed.
   */
  async rebalanceColumn(
    projectId: string,
    status: TaskStatus,
    movedTaskId: string,
    db: Prisma.TransactionClient,
  ): Promise<string[]> {
    const rows = await db.$queryRaw<Array<{ id: string }>>`
      UPDATE tasks AS t
      SET position = ranked.position, updated_at = CURRENT_TIMESTAMP
      FROM (
        SELECT id,
               (row_number() OVER (
                  ORDER BY position, id = ${movedTaskId}::uuid DESC, id
                ))::float8 * ${POSITION_STEP} AS position
        FROM tasks
        WHERE project_id = ${projectId}::uuid
          AND status = ${status}::"TaskStatus"
          AND deleted_at IS NULL
      ) AS ranked
      WHERE t.id = ranked.id AND t.position <> ranked.position
      RETURNING t.id`;
    return rows.map((row) => row.id);
  }

  /** Assignees must be members of the task's organization (also enforced by a foreign key). */
  async isOrganizationMember(
    organizationId: string,
    userId: string,
    db: Db = this.prisma,
  ): Promise<boolean> {
    const count = await db.membership.count({ where: { organizationId, userId } });
    return count > 0;
  }
}
