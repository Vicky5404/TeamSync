import { Injectable } from '@nestjs/common';

import { hasPermission } from '../../common/authorization/permissions.js';
import type { AccessContext } from '../../common/auth/auth.types.js';
import { Errors } from '../../common/errors/api-exception.js';
import { NotificationType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { NotificationIntent } from '../../infrastructure/queue/queue.constants.js';
import { ActivityService } from '../activity/activity.service.js';
import { ActivityAction, taskTarget } from '../activity/activity.types.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction, auditBase } from '../audit/audit.types.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeEvent } from '../realtime/realtime.events.js';
import { RealtimePublisher } from '../realtime/realtime.publisher.js';
import { TasksService } from '../tasks/tasks.service.js';

import { commentInclude, CommentsRepository, toCommentDto } from './comments.repository.js';
import type { CommentDto, CreateCommentDto, UpdateCommentDto } from './dto/comment.dto.js';
import { extractMentionedEmails } from './mentions.js';

const PREVIEW_LENGTH = 140;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly comments: CommentsRepository,
    private readonly tasks: TasksService,
    private readonly activity: ActivityService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimePublisher,
  ) {}

  async list(access: AccessContext): Promise<CommentDto[]> {
    const rows = await this.comments.listForTask(requireTaskId(access));
    return rows.map(toCommentDto);
  }

  async create(access: AccessContext, input: CreateCommentDto): Promise<CommentDto> {
    const task = await this.requireTask(access);
    const mentionedIds = (await this.resolveMentions(access.organizationId, input)).filter(
      (id) => id !== access.userId,
    );

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          taskId: task.id,
          authorId: access.userId,
          body: input.body,
          mentions: { create: mentionedIds.map((userId) => ({ userId })) },
        },
        include: commentInclude,
      });
      await this.activity.record(
        {
          organizationId: access.organizationId,
          projectId: task.projectId,
          taskId: task.id,
          actorId: access.userId,
          action: ActivityAction.TASK_COMMENTED,
          target: taskTarget(task),
          metadata: { commentId: created.id },
        },
        tx,
      );
      return created;
    });

    const identifier = `${task.project.key}-${task.number}`;
    const authorName = comment.author?.name ?? 'Someone';
    const preview = input.body.slice(0, PREVIEW_LENGTH);
    const resource = { type: 'task' as const, id: task.id, projectId: task.projectId };
    const intents: NotificationIntent[] = mentionedIds.map((userId) => ({
      userId,
      type: NotificationType.MENTIONED,
      title: `${authorName} mentioned you on ${identifier}`,
      body: preview,
      actorId: access.userId,
      organizationId: access.organizationId,
      resource,
    }));
    // Assignee and reporter follow the task; mentioned users already got a (more specific) notification.
    for (const userId of new Set([task.assigneeId, task.reporterId])) {
      if (userId && !mentionedIds.includes(userId)) {
        intents.push({
          userId,
          type: NotificationType.TASK_COMMENTED,
          title: `New comment on ${identifier}`,
          body: preview,
          actorId: access.userId,
          organizationId: access.organizationId,
          resource,
        });
      }
    }
    await this.notifications.notify(intents);

    const dto = toCommentDto(comment);
    void this.realtime.publishToProject(
      RealtimeEvent.COMMENT_CREATED,
      access.organizationId,
      task.projectId,
      dto,
    );
    await this.tasks.republish(access.organizationId, task.id);
    return dto;
  }

  /** Only the author may edit a comment. Newly mentioned users are notified. */
  async update(
    access: AccessContext,
    commentId: string,
    input: UpdateCommentDto,
  ): Promise<CommentDto> {
    const task = await this.requireTask(access);
    const current = await this.comments.find(commentId, task.id);
    if (!current) throw Errors.notFound('Comment');
    if (current.authorId !== access.userId)
      throw Errors.forbidden('You can only edit your own comments.');

    const mentionedIds = (await this.resolveMentions(access.organizationId, input)).filter(
      (id) => id !== access.userId,
    );
    const previous = new Set(current.mentions.map((mention) => mention.user.id));
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.commentMention.deleteMany({ where: { commentId, userId: { notIn: mentionedIds } } });
      await tx.commentMention.createMany({
        data: mentionedIds.map((userId) => ({ commentId, userId })),
        skipDuplicates: true,
      });
      return tx.comment.update({
        where: { id: commentId },
        data: { body: input.body, editedAt: new Date() },
        include: commentInclude,
      });
    });

    const identifier = `${task.project.key}-${task.number}`;
    await this.notifications.notify(
      mentionedIds
        .filter((userId) => !previous.has(userId))
        .map((userId) => ({
          userId,
          type: NotificationType.MENTIONED,
          title: `${updated.author?.name ?? 'Someone'} mentioned you on ${identifier}`,
          body: input.body.slice(0, PREVIEW_LENGTH),
          actorId: access.userId,
          organizationId: access.organizationId,
          resource: { type: 'task', id: task.id, projectId: task.projectId },
        })),
    );
    return toCommentDto(updated);
  }

  /**
   * Authors may delete their comments; admins can moderate any comment.
   * Comments are soft-deleted (hidden at once, purged after the retention
   * window) so moderation can be reviewed; moderation is audited.
   */
  async delete(access: AccessContext, commentId: string): Promise<void> {
    const taskId = requireTaskId(access);
    const current = await this.comments.find(commentId, taskId);
    if (!current) throw Errors.notFound('Comment');
    const moderated = current.authorId !== access.userId;
    if (moderated && !hasPermission(access.role, 'comments:moderate')) {
      throw Errors.forbidden('You can only delete your own comments.');
    }
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.comment.updateMany({
        where: { id: commentId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (count === 0) throw Errors.notFound('Comment');
      if (moderated) {
        await this.audit.record(
          {
            ...auditBase(access),
            action: AuditAction.COMMENT_MODERATED,
            entityType: 'comment',
            entityId: commentId,
            metadata: { taskId, authorId: current.authorId },
          },
          tx,
        );
      }
    });
    await this.tasks.republish(access.organizationId, taskId);
  }

  private async requireTask(access: AccessContext) {
    const task = await this.prisma.task.findFirst({
      where: { id: requireTaskId(access), organizationId: access.organizationId, deletedAt: null },
      select: {
        id: true,
        title: true,
        number: true,
        projectId: true,
        assigneeId: true,
        reporterId: true,
        project: { select: { key: true } },
      },
    });
    if (!task) throw Errors.notFound('Task');
    return task;
  }

  private resolveMentions(organizationId: string, input: CreateCommentDto): Promise<string[]> {
    return this.comments.resolveMembers(
      organizationId,
      input.mentionedUserIds ?? [],
      extractMentionedEmails(input.body),
    );
  }
}

function requireTaskId(access: AccessContext): string {
  if (!access.taskId) throw Errors.notFound('Task');
  return access.taskId;
}
