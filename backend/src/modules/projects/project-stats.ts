import { startOfTodayUTC } from '../../common/utils/dates.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { TaskStatus } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

export interface ProjectStats {
  total: number;
  completed: number;
  overdue: number;
  /** Completion percentage (0–100). */
  progress: number;
}

export const EMPTY_PROJECT_STATS: ProjectStats = {
  total: 0,
  completed: 0,
  overdue: 0,
  progress: 0,
};

export function progressOf(completed: number, total: number): number {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

/**
 * Task counts for many projects in two grouped queries (no N+1), used by
 * project lists, member profiles and analytics.
 */
export async function projectTaskStats(
  db: PrismaService | Prisma.TransactionClient,
  projectIds: string[],
  today = startOfTodayUTC(),
): Promise<Map<string, ProjectStats>> {
  const stats = new Map<string, ProjectStats>();
  if (projectIds.length === 0) return stats;

  const [byStatus, overdue] = await Promise.all([
    db.task.groupBy({
      by: ['projectId', 'status'],
      where: { projectId: { in: projectIds }, deletedAt: null },
      _count: { _all: true },
    }),
    db.task.groupBy({
      by: ['projectId'],
      where: {
        projectId: { in: projectIds },
        deletedAt: null,
        status: { not: TaskStatus.DONE },
        dueDate: { lt: today },
      },
      _count: { _all: true },
    }),
  ]);

  for (const projectId of projectIds) stats.set(projectId, { ...EMPTY_PROJECT_STATS });
  for (const row of byStatus) {
    const entry = stats.get(row.projectId);
    if (!entry) continue;
    entry.total += row._count._all;
    if (row.status === TaskStatus.DONE) entry.completed += row._count._all;
  }
  for (const row of overdue) {
    const entry = stats.get(row.projectId);
    if (entry) entry.overdue = row._count._all;
  }
  for (const entry of stats.values()) entry.progress = progressOf(entry.completed, entry.total);
  return stats;
}
