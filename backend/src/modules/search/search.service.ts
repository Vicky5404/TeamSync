import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

import type { SearchResultsDto } from './search.dto.js';

const IDENTIFIER = /^([A-Za-z][A-Za-z0-9]{1,5})-(\d{1,9})$/;

/** Organization-wide quick search (command palette). Trigram indexes back the ILIKE scans. */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    organizationId: string,
    query: string | undefined,
    limit = 5,
  ): Promise<SearchResultsDto> {
    const term = query?.trim() ?? '';
    if (term.length < 2) return { projects: [], tasks: [], members: [] };
    const identifier = IDENTIFIER.exec(term);

    const [projects, tasks, members] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { key: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, key: true, status: true },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      this.prisma.task.findMany({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            ...(identifier?.[1] && identifier[2]
              ? [{ number: Number(identifier[2]), project: { key: identifier[1].toUpperCase() } }]
              : []),
          ],
        },
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          projectId: true,
          project: { select: { key: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      this.prisma.membership.findMany({
        where: {
          organizationId,
          user: {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { email: { contains: term, mode: 'insensitive' } },
            ],
          },
        },
        select: {
          id: true,
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        take: limit,
      }),
    ]);

    return {
      projects,
      tasks: tasks.map((task) => ({
        id: task.id,
        identifier: `${task.project.key}-${task.number}`,
        title: task.title,
        status: task.status,
        projectId: task.projectId,
        projectName: task.project.name,
      })),
      members: members.map((member) => ({
        id: member.id,
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        avatarUrl: member.user.avatarUrl,
      })),
    };
  }
}
