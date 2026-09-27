import type { Redis } from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { CacheService } from '../../infrastructure/redis/cache.service.js';

import { AccessResolver } from './access-resolver.service.js';

const ORG_A = '0190f0a0-0000-7000-8000-0000000000a1';
const ORG_B = '0190f0a0-0000-7000-8000-0000000000b1';
const PROJECT_B = '0190f0a0-0000-7000-8000-0000000000b2';
const TASK_B = '0190f0a0-0000-7000-8000-0000000000b3';
const USER_A = '0190f0a0-0000-7000-8000-0000000000c1';

/**
 * Tenant isolation: every organization-owned resource resolves to its own
 * organization, and callers who are not members of *that* organization get a
 * 404 (not 403) so other tenants' resources are indistinguishable from
 * non-existent ones.
 */
describe('AccessResolver (tenant isolation)', () => {
  const store = new Map<string, unknown>();
  const cache = {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    del: vi.fn((...keys: string[]) => {
      keys.forEach((key) => store.delete(key));
      return Promise.resolve();
    }),
  };
  const prisma = {
    membership: { findUnique: vi.fn(), update: vi.fn() },
    project: { findUnique: vi.fn() },
    task: { findUnique: vi.fn() },
    comment: { findFirst: vi.fn() },
    attachment: { findFirst: vi.fn() },
  };
  const redis = { set: vi.fn(() => Promise.resolve(null)) };
  let resolver: AccessResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    resolver = new AccessResolver(
      prisma as unknown as PrismaService,
      cache as unknown as CacheService,
      redis as unknown as Redis,
    );
    // USER_A belongs to ORG_A only.
    prisma.membership.findUnique.mockImplementation(
      ({ where }: { where: { organizationId_userId: { organizationId: string } } }) =>
        Promise.resolve(
          where.organizationId_userId.organizationId === ORG_A
            ? { id: 'membership-a', role: Role.ADMIN }
            : null,
        ),
    );
  });

  it('grants members access to their own organization with their role', async () => {
    await expect(resolver.resolve({ organizationId: ORG_A }, USER_A)).resolves.toMatchObject({
      organizationId: ORG_A,
      membershipId: 'membership-a',
      role: Role.ADMIN,
    });
  });

  it('hides other organizations behind a 404', async () => {
    await expect(resolver.resolve({ organizationId: ORG_B }, USER_A)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("resolves a project to its owner organization — another tenant's project is a 404", async () => {
    prisma.project.findUnique.mockResolvedValue({ organizationId: ORG_B, deletedAt: null });
    await expect(resolver.resolve({ projectId: PROJECT_B }, USER_A)).rejects.toMatchObject({
      status: 404,
    });
    expect(prisma.membership.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_userId: { organizationId: ORG_B, userId: USER_A } },
      }),
    );
  });

  it('does the same for tasks, comments and attachments of another tenant', async () => {
    prisma.task.findUnique.mockResolvedValue({
      organizationId: ORG_B,
      projectId: PROJECT_B,
      deletedAt: null,
    });
    prisma.comment.findFirst.mockResolvedValue({
      task: { id: TASK_B, organizationId: ORG_B, projectId: PROJECT_B },
    });
    prisma.attachment.findFirst.mockResolvedValue({
      organizationId: ORG_B,
      taskId: TASK_B,
      task: { projectId: PROJECT_B },
    });
    for (const params of [{ taskId: TASK_B }, { commentId: TASK_B }, { attachmentId: TASK_B }]) {
      await expect(resolver.resolve(params, USER_A)).rejects.toMatchObject({ status: 404 });
    }
  });

  it('never trusts a client-supplied organization for nested resources', async () => {
    // Even if a URL combined an own organization id with a foreign task, the
    // task's organization is looked up from the database.
    prisma.task.findUnique.mockResolvedValue({
      organizationId: ORG_B,
      projectId: PROJECT_B,
      deletedAt: null,
    });
    await expect(resolver.resolve({ taskId: TASK_B }, USER_A)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('treats resources in the trash as not found unless explicitly allowed', async () => {
    prisma.project.findUnique.mockResolvedValue({ organizationId: ORG_A, deletedAt: new Date() });
    await expect(resolver.resolve({ projectId: PROJECT_B }, USER_A)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      resolver.resolve({ projectId: PROJECT_B }, USER_A, { includeDeleted: true }),
    ).resolves.toMatchObject({ organizationId: ORG_A, projectId: PROJECT_B });
  });

  it('rejects malformed ids without touching the database', async () => {
    await expect(resolver.resolve({ projectId: "1' OR '1'='1" }, USER_A)).rejects.toMatchObject({
      status: 404,
    });
    expect(prisma.project.findUnique).not.toHaveBeenCalled();
  });

  it('caches memberships and forgets them when they change', async () => {
    await resolver.resolve({ organizationId: ORG_A }, USER_A);
    await resolver.resolve({ organizationId: ORG_A }, USER_A);
    expect(prisma.membership.findUnique).toHaveBeenCalledTimes(1);

    // Member removed: the next request must hit the database again.
    await resolver.invalidateMembership(ORG_A, USER_A);
    prisma.membership.findUnique.mockResolvedValue(null);
    await expect(resolver.resolve({ organizationId: ORG_A }, USER_A)).rejects.toMatchObject({
      status: 404,
    });
  });
});
