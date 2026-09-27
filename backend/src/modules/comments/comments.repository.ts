import { Injectable } from '@nestjs/common';

import { toUserSummary, userSummarySelect } from '../../common/dto/user-summary.dto.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

import type { CommentDto } from './dto/comment.dto.js';

const COMMENTS_LIMIT = 1000;

export const commentInclude = {
  author: { select: userSummarySelect },
  mentions: { select: { user: { select: userSummarySelect } } },
} as const satisfies Prisma.CommentInclude;

export type CommentRow = Prisma.CommentGetPayload<{ include: typeof commentInclude }>;

export function toCommentDto(row: CommentRow): CommentDto {
  return {
    id: row.id,
    taskId: row.taskId,
    author: toUserSummary(row.author, row.authorId ?? ''),
    body: row.body,
    mentions: row.mentions.map((mention) => toUserSummary(mention.user)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: (row.editedAt ?? row.createdAt).toISOString(),
    edited: row.editedAt !== null,
  };
}

@Injectable()
export class CommentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForTask(taskId: string): Promise<CommentRow[]> {
    return this.prisma.comment.findMany({
      where: { taskId, deletedAt: null },
      include: commentInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: COMMENTS_LIMIT,
    });
  }

  find(commentId: string, taskId: string): Promise<CommentRow | null> {
    return this.prisma.comment.findFirst({
      where: { id: commentId, taskId, deletedAt: null },
      include: commentInclude,
    });
  }

  /** Organization members among the given user ids and/or emails. */
  async resolveMembers(
    organizationId: string,
    userIds: string[],
    emails: string[],
  ): Promise<string[]> {
    if (userIds.length === 0 && emails.length === 0) return [];
    const rows = await this.prisma.membership.findMany({
      where: {
        organizationId,
        OR: [
          ...(userIds.length ? [{ userId: { in: userIds } }] : []),
          ...(emails.length ? [{ user: { email: { in: emails } } }] : []),
        ],
      },
      select: { userId: true },
    });
    return [...new Set(rows.map((row) => row.userId))];
  }
}
