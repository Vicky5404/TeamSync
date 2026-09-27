import { toUserSummary, userSummarySelect } from '../../common/dto/user-summary.dto.js';
import { toISODate } from '../../common/utils/dates.js';
import type { Prisma } from '../../generated/prisma/client.js';

import type { ProjectDto } from './dto/project.dto.js';
import { EMPTY_PROJECT_STATS, type ProjectStats } from './project-stats.js';

export const projectInclude = {
  owner: { select: userSummarySelect },
  members: {
    select: { user: { select: userSummarySelect } },
    orderBy: { addedAt: 'asc' },
  },
} as const satisfies Prisma.ProjectInclude;

export type ProjectRow = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

export function toProjectDto(
  project: ProjectRow,
  stats: ProjectStats = EMPTY_PROJECT_STATS,
): ProjectDto {
  return {
    id: project.id,
    organizationId: project.organizationId,
    key: project.key,
    name: project.name,
    description: project.description,
    status: project.status,
    progress: stats.progress,
    members: project.members.map((member) => toUserSummary(member.user)),
    taskCounts: { total: stats.total, completed: stats.completed, overdue: stats.overdue },
    owner: toUserSummary(project.owner, project.ownerId ?? ''),
    startDate: toISODate(project.startDate),
    dueDate: toISODate(project.dueDate),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
