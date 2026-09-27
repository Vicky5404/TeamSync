import { createContext, useContext, useMemo } from 'react';

import { hasPermission, type Permission } from '@/lib/permissions';
import type { Organization, Role } from '@/types';

export const ActiveOrganizationContext = createContext<Organization | null>(null);

/**
 * The organization the user is currently working in. Only available below
 * `OrganizationGate`, which guarantees it is resolved.
 */
export function useActiveOrganization(): Organization {
  const organization = useContext(ActiveOrganizationContext);
  if (!organization) {
    throw new Error('useActiveOrganization must be used inside <OrganizationGate>.');
  }
  return organization;
}

export interface PermissionsApi {
  role: Role;
  can: (permission: Permission) => boolean;
}

/** Role-based checks for the active organization (UI affordances only). */
export function usePermissions(): PermissionsApi {
  const { role } = useActiveOrganization();
  return useMemo(() => ({ role, can: (permission) => hasPermission(role, permission) }), [role]);
}
