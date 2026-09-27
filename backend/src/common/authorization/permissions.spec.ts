import { describe, expect, it } from 'vitest';

import { Role } from '../../generated/prisma/enums.js';

import { assignableRoles, canManageMember, hasPermission } from './permissions.js';

describe('permissions', () => {
  it('grants permissions by role, cumulatively', () => {
    expect(hasPermission(Role.VIEWER, 'tasks:update')).toBe(false);
    expect(hasPermission(Role.MEMBER, 'tasks:update')).toBe(true);
    expect(hasPermission(Role.MEMBER, 'projects:create')).toBe(false);
    expect(hasPermission(Role.MANAGER, 'projects:create')).toBe(true);
    expect(hasPermission(Role.MANAGER, 'projects:delete')).toBe(false);
    expect(hasPermission(Role.ADMIN, 'projects:delete')).toBe(true);
    expect(hasPermission(Role.ADMIN, 'organization:delete')).toBe(false);
    expect(hasPermission(Role.OWNER, 'organization:delete')).toBe(true);
    expect(hasPermission(Role.MANAGER, 'audit:read')).toBe(false);
    expect(hasPermission(Role.ADMIN, 'audit:read')).toBe(true);
    expect(hasPermission(undefined, 'tasks:create')).toBe(false);
  });

  it('only lets actors assign roles strictly below their own, never OWNER', () => {
    expect(assignableRoles(Role.OWNER)).toEqual([
      Role.ADMIN,
      Role.MANAGER,
      Role.MEMBER,
      Role.VIEWER,
    ]);
    expect(assignableRoles(Role.ADMIN)).toEqual([Role.MANAGER, Role.MEMBER, Role.VIEWER]);
    expect(assignableRoles(Role.MANAGER)).toEqual([Role.MEMBER, Role.VIEWER]);
    expect(assignableRoles(Role.MEMBER)).toEqual([]);
    expect(assignableRoles(Role.VIEWER)).toEqual([]);
  });

  it('requires members:manage and a higher rank to manage a member', () => {
    expect(canManageMember(Role.OWNER, Role.ADMIN)).toBe(true);
    expect(canManageMember(Role.ADMIN, Role.MANAGER)).toBe(true);
    expect(canManageMember(Role.ADMIN, Role.ADMIN)).toBe(false);
    expect(canManageMember(Role.ADMIN, Role.OWNER)).toBe(false);
    // Managers can invite but not manage existing members.
    expect(canManageMember(Role.MANAGER, Role.VIEWER)).toBe(false);
  });
});
