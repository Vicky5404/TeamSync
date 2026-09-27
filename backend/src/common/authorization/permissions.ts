import { Role } from '../../generated/prisma/enums.js';

/**
 * Organization-level RBAC. The web client mirrors a subset of this table in
 * `frontend/src/lib/permissions.ts` for UX only — this is the enforcement point.
 */
export type Permission =
  | 'organization:update'
  | 'organization:delete'
  | 'members:invite'
  | 'members:manage'
  | 'projects:create'
  | 'projects:update'
  | 'projects:delete'
  | 'tasks:create'
  | 'tasks:update'
  | 'tasks:delete'
  | 'comments:create'
  | 'comments:moderate'
  | 'labels:manage'
  | 'files:upload'
  | 'reports:create'
  | 'audit:read';

const MEMBER_PERMISSIONS: Permission[] = [
  'tasks:create',
  'tasks:update',
  'tasks:delete',
  'comments:create',
  'files:upload',
];

const MANAGER_PERMISSIONS: Permission[] = [
  ...MEMBER_PERMISSIONS,
  'members:invite',
  'projects:create',
  'projects:update',
  'labels:manage',
  'reports:create',
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...MANAGER_PERMISSIONS,
  'organization:update',
  'members:manage',
  'projects:delete',
  'comments:moderate',
  'audit:read',
];

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  OWNER: new Set<Permission>([...ADMIN_PERMISSIONS, 'organization:delete']),
  ADMIN: new Set(ADMIN_PERMISSIONS),
  MANAGER: new Set(MANAGER_PERMISSIONS),
  MEMBER: new Set(MEMBER_PERMISSIONS),
  VIEWER: new Set<Permission>(),
};

/** Higher rank = more privileges. */
export const ROLE_RANK: Record<Role, number> = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  MEMBER: 2,
  VIEWER: 1,
};

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  return role ? ROLE_PERMISSIONS[role].has(permission) : false;
}

/** Roles an actor may grant when inviting or changing a member's role (never OWNER). */
export function assignableRoles(actorRole: Role): Role[] {
  if (!hasPermission(actorRole, 'members:invite')) return [];
  const rank = ROLE_RANK[actorRole];
  return Object.values(Role).filter((role) => role !== Role.OWNER && ROLE_RANK[role] < rank);
}

/** Whether the actor may change the role of, or remove, a member holding `targetRole`. */
export function canManageMember(actorRole: Role, targetRole: Role): boolean {
  return hasPermission(actorRole, 'members:manage') && ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}
