import type { Role } from '@/types';

/**
 * Client-side permission model. It only drives what the UI offers — the API
 * remains the source of truth and must enforce the same rules.
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
  | 'comments:create';

const MEMBER_PERMISSIONS: Permission[] = [
  'tasks:create',
  'tasks:update',
  'tasks:delete',
  'comments:create',
];

const MANAGER_PERMISSIONS: Permission[] = [
  ...MEMBER_PERMISSIONS,
  'members:invite',
  'projects:create',
  'projects:update',
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...MANAGER_PERMISSIONS,
  'organization:update',
  'members:manage',
  'projects:delete',
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

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: 'Full control, including billing and deleting the organization.',
  ADMIN: 'Manage members, settings and all projects.',
  MANAGER: 'Create and manage projects, invite members.',
  MEMBER: 'Create and work on tasks, comment and collaborate.',
  VIEWER: 'Read-only access to projects and tasks.',
};

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  return role ? ROLE_PERMISSIONS[role].has(permission) : false;
}

/** Roles an actor may grant when inviting or changing a member's role. */
export function assignableRoles(actorRole: Role): Role[] {
  if (!hasPermission(actorRole, 'members:invite')) return [];
  const rank = ROLE_RANK[actorRole];
  return (Object.keys(ROLE_RANK) as Role[])
    .filter((role) => role !== 'OWNER' && ROLE_RANK[role] < rank)
    .sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a]);
}

/** Whether the actor may change the role of, or remove, a member with `targetRole`. */
export function canManageMember(actorRole: Role, targetRole: Role): boolean {
  return hasPermission(actorRole, 'members:manage') && ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}
