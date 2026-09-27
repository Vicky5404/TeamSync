import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../generated/prisma/enums.js';
import { ALLOW_DELETED_KEY, IS_PUBLIC_KEY, PERMISSION_KEY } from '../auth/decorators.js';

import { AccessGuard } from './access.guard.js';
import type { AccessResolver } from './access-resolver.service.js';

function context(
  request: Record<string, unknown>,
  metadata: Record<string, unknown> = {},
): ExecutionContext {
  const handler = () => undefined;
  Reflect.defineMetadata(IS_PUBLIC_KEY, metadata[IS_PUBLIC_KEY], handler);
  Reflect.defineMetadata(PERMISSION_KEY, metadata[PERMISSION_KEY], handler);
  Reflect.defineMetadata(ALLOW_DELETED_KEY, metadata[ALLOW_DELETED_KEY], handler);
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AccessGuard', () => {
  const resolver = { resolve: vi.fn() };
  const guard = new AccessGuard(new Reflector(), resolver as unknown as AccessResolver);
  const access = { userId: 'u1', organizationId: 'o1', membershipId: 'm1', role: Role.MEMBER };

  beforeEach(() => vi.resetAllMocks());

  it('ignores routes without organization-scoped params', async () => {
    await expect(
      guard.canActivate(context({ params: { sessionId: 'x' }, user: { id: 'u1' } })),
    ).resolves.toBe(true);
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('checks membership on every scoped route, even without a declared permission', async () => {
    resolver.resolve.mockResolvedValue(access);
    const request: Record<string, unknown> = {
      params: { taskId: 't1' },
      user: { id: 'u1' },
      headers: { 'user-agent': 'vitest' },
      ip: '203.0.113.7',
      id: 'req-1',
    };
    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(resolver.resolve).toHaveBeenCalledWith({ taskId: 't1' }, 'u1', {
      includeDeleted: false,
    });
    // Request metadata travels with the access context for the audit log.
    expect(request.access).toEqual({
      ...access,
      client: { ipAddress: '203.0.113.7', userAgent: 'vitest', requestId: 'req-1' },
    });
  });

  it('only resolves resources in the trash on routes marked @AllowDeleted()', async () => {
    resolver.resolve.mockResolvedValue(access);
    await guard.canActivate(
      context(
        { params: { projectId: 'p1' }, user: { id: 'u1' }, headers: {} },
        { [ALLOW_DELETED_KEY]: true },
      ),
    );
    expect(resolver.resolve).toHaveBeenCalledWith({ projectId: 'p1' }, 'u1', {
      includeDeleted: true,
    });
  });

  it('returns 403 when the role lacks the permission', async () => {
    resolver.resolve.mockResolvedValue({ ...access, role: Role.VIEWER });
    await expect(
      guard.canActivate(
        context(
          { params: { projectId: 'p1' }, user: { id: 'u1' }, headers: {} },
          { [PERMISSION_KEY]: 'tasks:create' },
        ),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('propagates 404 for non-members', async () => {
    resolver.resolve.mockRejectedValue(
      Object.assign(new Error('Organization not found.'), { code: 'NOT_FOUND' }),
    );
    await expect(
      guard.canActivate(context({ params: { organizationId: 'o2' }, user: { id: 'u1' } })),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('skips public routes', async () => {
    await expect(
      guard.canActivate(context({ params: { organizationId: 'o1' } }, { [IS_PUBLIC_KEY]: true })),
    ).resolves.toBe(true);
  });

  it('fails loudly on a misconfigured route (permission without scope)', async () => {
    await expect(
      guard.canActivate(
        context({ params: {}, user: { id: 'u1' } }, { [PERMISSION_KEY]: 'projects:create' }),
      ),
    ).rejects.toThrow(/without an organization scope/);
  });
});
