import { Injectable } from '@nestjs/common';

import { type PageWindow, pageWindow } from '../../common/utils/pagination.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ProjectStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

import type { ProjectSort } from './dto/project.dto.js';
import { projectInclude, type ProjectRow } from './project.mapper.js';
import { projectTaskStats, type ProjectStats } from './project-stats.js';

type Db = PrismaService | Prisma.TransactionClient;

export interface ProjectFilters {
  search?: string;
  status?: ProjectStatus[];
}

const ORDER_BY: Record<
  Exclude<ProjectSort, 'progress'>,
  Prisma.ProjectOrderByWithRelationInput[]
> = {
  updated: [{ updatedAt: 'desc' }, { id: 'desc' }],
  created: [{ createdAt: 'desc' }, { id: 'desc' }],
  name: [{ name: 'asc' }, { id: 'asc' }],
  dueDate: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
};

@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findInOrganization(
    organizationId: string,
    projectId: string,
    db: Db = this.prisma,
  ): Promise<ProjectRow | null> {
    return db.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
      include: projectInclude,
    });
  }

  stats(projectIds: string[], db: Db = this.prisma): Promise<Map<string, ProjectStats>> {
    return projectTaskStats(db, projectIds);
  }

  /**
   * Filtered, sorted page of projects plus their task stats. Sorting by
   * progress needs stats for every match, so it pages in memory; all other
   * sorts page in the database.
   */
  async list(
    organizationId: string,
    filters: ProjectFilters,
    sort: ProjectSort,
    page: number | undefined,
    pageSize: number | undefined,
  ): Promise<{
    rows: ProjectRow[];
    stats: Map<string, ProjectStats>;
    total: number;
    window: PageWindow;
  }> {
    const where = this.where(organizationId, filters);
    const total = await this.prisma.project.count({ where });
    const window = pageWindow(total, page, pageSize);

    if (sort === 'progress') {
      const ids = (await this.prisma.project.findMany({ where, select: { id: true } })).map(
        (row) => row.id,
      );
      const allStats = await this.stats(ids);
      const pageIds = ids
        .sort(
          (a, b) =>
            (allStats.get(b)?.progress ?? 0) - (allStats.get(a)?.progress ?? 0) ||
            a.localeCompare(b),
        )
        .slice(window.skip, window.skip + window.take);
      const rows = await this.prisma.project.findMany({
        where: { id: { in: pageIds } },
        include: projectInclude,
      });
      const order = new Map(pageIds.map((id, index) => [id, index]));
      rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      return { rows, stats: allStats, total, window };
    }

    const rows = await this.prisma.project.findMany({
      where,
      include: projectInclude,
      orderBy: ORDER_BY[sort],
      skip: window.skip,
      take: window.take,
    });
    return { rows, stats: await this.stats(rows.map((row) => row.id)), total, window };
  }

  /** Keep only user ids that belong to the organization. */
  async organizationUserIds(
    organizationId: string,
    userIds: string[],
    db: Db = this.prisma,
  ): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await db.membership.findMany({
      where: { organizationId, userId: { in: userIds } },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  }

  private where(organizationId: string, filters: ProjectFilters): Prisma.ProjectWhereInput {
    const search = filters.search;
    return {
      organizationId,
      deletedAt: null,
      ...(filters.status?.length ? { status: { in: filters.status } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { key: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }
}
