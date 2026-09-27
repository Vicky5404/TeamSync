import type { ReactNode } from 'react';

import type { Permission } from '@/lib/permissions';

import { usePermissions } from '../active-organization';

interface CanProps {
  permission: Permission;
  children: ReactNode;
  /** Rendered when the permission is missing (defaults to nothing). */
  fallback?: ReactNode;
}

/** Renders children only if the current role grants `permission`. */
export function Can({ permission, children, fallback = null }: CanProps) {
  const { can } = usePermissions();
  return <>{can(permission) ? children : fallback}</>;
}
