import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

export interface DayCount {
  date: string;
  count: number;
}

export interface Scope {
  organizationId: string;
  projectId?: string;
}

/**
 * Aggregation queries that are clearer (and faster) in SQL than through the
 * query builder. Task queries only see live rows (`deleted_at IS NULL`), which
 * is also what lets them use the partial (organization_id|project_id, …)
 * indexes; counts are cast to int to avoid BigInt.
 */
@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Tasks created per UTC day since `from`. */
  createdPerDay(scope: Scope, from: Date): Promise<DayCount[]> {
    return this.prisma.$queryRaw<DayCount[]>`
      SELECT to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS date, count(*)::int AS count
      FROM tasks
      WHERE ${this.scopeSql(scope)} AND created_at >= ${from}
      GROUP BY 1`;
  }

  /** Tasks completed per UTC day since `from` (only tasks that are still done). */
  completedPerDay(scope: Scope, from: Date): Promise<DayCount[]> {
    return this.prisma.$queryRaw<DayCount[]>`
      SELECT to_char((completed_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS date, count(*)::int AS count
      FROM tasks
      WHERE ${this.scopeSql(scope)} AND status = 'DONE' AND completed_at >= ${from}
      GROUP BY 1`;
  }

  async averageCycleTimeDays(scope: Scope): Promise<{ samples: number; days: number | null }> {
    const [row] = await this.prisma.$queryRaw<Array<{ samples: number; days: number | null }>>`
      SELECT count(*)::int AS samples,
             (avg(extract(epoch FROM completed_at - created_at)) / 86400)::float8 AS days
      FROM tasks
      WHERE ${this.scopeSql(scope)} AND status = 'DONE' AND completed_at IS NOT NULL`;
    return row ?? { samples: 0, days: null };
  }

  activityPerDay(organizationId: string, from: Date): Promise<DayCount[]> {
    return this.prisma.$queryRaw<DayCount[]>`
      SELECT to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS date, count(*)::int AS count
      FROM activities
      WHERE organization_id = ${organizationId}::uuid AND created_at >= ${from}
      GROUP BY 1`;
  }

  private scopeSql(scope: Scope): Prisma.Sql {
    return scope.projectId
      ? Prisma.sql`project_id = ${scope.projectId}::uuid AND deleted_at IS NULL`
      : Prisma.sql`organization_id = ${scope.organizationId}::uuid AND deleted_at IS NULL`;
  }
}
