import { Injectable } from '@nestjs/common';

import { toUserSummary, userSummarySelect } from '../../common/dto/user-summary.dto.js';
import {
  afterCursor,
  type CursorPage,
  keysetOrder,
  resolveLimit,
  toCursorPage,
} from '../../common/utils/pagination.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

import type { ActivityEntry, ActivityMetadata, ActivityTarget } from './activity.types.js';
import type { ActivityDto } from './dto/activity.dto.js';

type Db = PrismaService | Prisma.TransactionClient;

const activityInclude = {
  actor: { select: userSummarySelect },
} as const satisfies Prisma.ActivityInclude;
type ActivityRow = Prisma.ActivityGetPayload<{ include: typeof activityInclude }>;

const TASK_FEED_LIMIT = 50;

/**
 * Append-only activity log. Entries are written inside the same transaction
 * as the change they describe, so the history can't drift from the data.
 */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entries: ActivityEntry | ActivityEntry[], db: Db = this.prisma): Promise<void> {
    const list = Array.isArray(entries) ? entries : [entries];
    if (list.length === 0) return;
    await db.activity.createMany({
      data: list.map((entry) => ({
        organizationId: entry.organizationId,
        projectId: entry.projectId ?? null,
        taskId: entry.taskId ?? null,
        actorId: entry.actorId,
        action: entry.action,
        target: entry.target as unknown as Prisma.InputJsonObject,
        metadata: entry.metadata ?? {},
      })),
    });
  }

  listForOrganization(
    organizationId: string,
    query: { cursor?: string; limit?: number; actorId?: string },
  ): Promise<CursorPage<ActivityDto>> {
    return this.page(
      { organizationId, ...(query.actorId ? { actorId: query.actorId } : {}) },
      query,
    );
  }

  listForProject(
    projectId: string,
    query: { cursor?: string; limit?: number },
  ): Promise<CursorPage<ActivityDto>> {
    return this.page({ projectId }, query);
  }

  async listForTask(taskId: string): Promise<ActivityDto[]> {
    const rows = await this.prisma.activity.findMany({
      where: { taskId },
      include: activityInclude,
      orderBy: keysetOrder,
      take: TASK_FEED_LIMIT,
    });
    return rows.map(toActivityDto);
  }

  private async page(
    where: Prisma.ActivityWhereInput,
    query: { cursor?: string; limit?: number },
  ): Promise<CursorPage<ActivityDto>> {
    const limit = resolveLimit(query.limit);
    const rows = await this.prisma.activity.findMany({
      where: { ...where, ...afterCursor(query.cursor) },
      include: activityInclude,
      orderBy: keysetOrder,
      take: limit + 1,
    });
    return toCursorPage(rows, limit, toActivityDto);
  }
}

export function toActivityDto(row: ActivityRow): ActivityDto {
  return {
    id: row.id,
    action: row.action,
    actor: toUserSummary(row.actor, row.actorId ?? ''),
    target: row.target as unknown as ActivityTarget,
    metadata: (row.metadata ?? {}) as ActivityMetadata,
    createdAt: row.createdAt.toISOString(),
  };
}
