import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';

import type { Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { CacheService } from '../../infrastructure/redis/cache.service.js';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.constants.js';
import type { AccessContext } from '../auth/auth.types.js';
import { Errors } from '../errors/api-exception.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route params that identify an organization-owned resource, most specific last. */
export const SCOPE_PARAMS = [
  'organizationId',
  'projectId',
  'taskId',
  'commentId',
  'attachmentId',
] as const;
type ScopeParam = (typeof SCOPE_PARAMS)[number];

const MEMBERSHIP_TTL_SECONDS = 60;
const NEGATIVE_MEMBERSHIP_TTL_SECONDS = 15;
const SCOPE_TTL_SECONDS = 600;
const ACTIVITY_TOUCH_INTERVAL_SECONDS = 300;

interface CachedMembership {
  id: string;
  role: Role;
}

interface ResourceScope {
  organizationId: string;
  projectId?: string;
  taskId?: string;
}

export interface ResolveOptions {
  /** Resolve soft-deleted projects and tasks too (restore routes only). */
  includeDeleted?: boolean;
}

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

/**
 * Resolves which organization a resource belongs to and the caller's
 * membership in it. Membership and (immutable) resource→organization mappings
 * are cached in Redis; membership entries are invalidated on every change.
 * Soft-deleted projects, tasks and comments resolve as "not found" (their
 * cached scopes are dropped when they are deleted), so nothing nested under
 * a resource in the trash is reachable.
 */
@Injectable()
export class AccessResolver {
  private readonly logger = new Logger(AccessResolver.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Resolve access from route params; throws 404 for unknown resources or non-members. */
  async resolve(
    params: Partial<Record<ScopeParam, string>>,
    userId: string,
    options: ResolveOptions = {},
  ): Promise<AccessContext> {
    const { scope, resource } = await this.resolveScope(params, options.includeDeleted ?? false);
    const membership = await this.membership(scope.organizationId, userId);
    // 404 rather than 403 so the existence of other organizations' resources isn't leaked.
    if (!membership) throw Errors.notFound(resource);
    this.touchMembership(membership.id);
    return {
      userId,
      organizationId: scope.organizationId,
      membershipId: membership.id,
      role: membership.role,
      ...(scope.projectId ? { projectId: scope.projectId } : {}),
      ...(scope.taskId ? { taskId: scope.taskId } : {}),
    };
  }

  /** Membership lookup (cached). Returns null when the user is not a member. */
  async membership(organizationId: string, userId: string): Promise<CachedMembership | null> {
    const key = this.membershipKey(organizationId, userId);
    const cached = await this.cache.get<CachedMembership | { none: true }>(key);
    if (cached) return 'none' in cached ? null : cached;

    const row = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { id: true, role: true },
    });
    await this.cache.set(
      key,
      row ?? { none: true },
      row ? MEMBERSHIP_TTL_SECONDS : NEGATIVE_MEMBERSHIP_TTL_SECONDS,
    );
    return row;
  }

  /** Must be called whenever a membership is created, changes role or is removed. */
  async invalidateMembership(organizationId: string, ...userIds: string[]): Promise<void> {
    await this.cache.del(...userIds.map((userId) => this.membershipKey(organizationId, userId)));
  }

  /** Scope of a live project (or, with `includeDeleted`, one in the trash — never cached). */
  async projectScope(projectId: string, includeDeleted = false): Promise<ResourceScope | null> {
    if (!isUuid(projectId)) return null;
    const key = `scope:project:${projectId}`;
    if (!includeDeleted) {
      const cached = await this.cache.get<ResourceScope>(key);
      if (cached) return cached;
    }
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true, deletedAt: true },
    });
    if (!project || (project.deletedAt && !includeDeleted)) return null;
    const scope = { organizationId: project.organizationId, projectId };
    if (!project.deletedAt) await this.cache.set(key, scope, SCOPE_TTL_SECONDS);
    return scope;
  }

  /** Scope of a live task (or, with `includeDeleted`, one in the trash — never cached). */
  async taskScope(taskId: string, includeDeleted = false): Promise<ResourceScope | null> {
    if (!isUuid(taskId)) return null;
    const key = `scope:task:${taskId}`;
    if (!includeDeleted) {
      const cached = await this.cache.get<ResourceScope>(key);
      if (cached) return cached;
    }
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { organizationId: true, projectId: true, deletedAt: true },
    });
    if (!task || (task.deletedAt && !includeDeleted)) return null;
    const scope = { organizationId: task.organizationId, projectId: task.projectId, taskId };
    if (!task.deletedAt) await this.cache.set(key, scope, SCOPE_TTL_SECONDS);
    return scope;
  }

  async forgetProject(projectId: string): Promise<void> {
    await this.cache.del(`scope:project:${projectId}`);
  }

  async forgetTasks(...taskIds: string[]): Promise<void> {
    await this.cache.del(...taskIds.map((taskId) => `scope:task:${taskId}`));
  }

  private async resolveScope(
    params: Partial<Record<ScopeParam, string>>,
    includeDeleted: boolean,
  ): Promise<{ scope: ResourceScope; resource: string }> {
    if (params.organizationId !== undefined) {
      if (!isUuid(params.organizationId)) throw Errors.notFound('Organization');
      return { scope: { organizationId: params.organizationId }, resource: 'Organization' };
    }
    if (params.projectId !== undefined) {
      const scope = await this.projectScope(params.projectId, includeDeleted);
      if (!scope) throw Errors.notFound('Project');
      return { scope, resource: 'Project' };
    }
    if (params.taskId !== undefined) {
      const scope = await this.taskScope(params.taskId, includeDeleted);
      if (!scope) throw Errors.notFound('Task');
      return { scope, resource: 'Task' };
    }
    if (params.commentId !== undefined) {
      const comment = isUuid(params.commentId)
        ? await this.prisma.comment.findFirst({
            where: { id: params.commentId, deletedAt: null, task: { deletedAt: null } },
            select: { task: { select: { id: true, organizationId: true, projectId: true } } },
          })
        : null;
      if (!comment) throw Errors.notFound('Comment');
      const { task } = comment;
      return {
        scope: { organizationId: task.organizationId, projectId: task.projectId, taskId: task.id },
        resource: 'Comment',
      };
    }
    if (params.attachmentId !== undefined) {
      const attachment = isUuid(params.attachmentId)
        ? await this.prisma.attachment.findFirst({
            where: { id: params.attachmentId, task: { deletedAt: null } },
            select: { organizationId: true, taskId: true, task: { select: { projectId: true } } },
          })
        : null;
      if (!attachment) throw Errors.notFound('Attachment');
      return {
        scope: {
          organizationId: attachment.organizationId,
          projectId: attachment.task.projectId,
          taskId: attachment.taskId,
        },
        resource: 'Attachment',
      };
    }
    throw new Error('AccessResolver.resolve called without a scope parameter');
  }

  /** Record "last active" at most every few minutes per membership (fire-and-forget). */
  private touchMembership(membershipId: string): void {
    void this.redis
      .set(`membership-active:${membershipId}`, '1', 'EX', ACTIVITY_TOUCH_INTERVAL_SECONDS, 'NX')
      .then((result) =>
        result === 'OK'
          ? this.prisma.membership.update({
              where: { id: membershipId },
              data: { lastActiveAt: new Date() },
            })
          : null,
      )
      .catch((error: unknown) =>
        this.logger.debug(
          `Could not record member activity: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
  }

  private membershipKey(organizationId: string, userId: string): string {
    return `membership:${organizationId}:${userId}`;
  }
}
