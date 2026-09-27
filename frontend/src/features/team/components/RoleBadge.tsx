import { Crown, Shield } from 'lucide-react';

import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { ROLE_LABELS } from '@/lib/permissions';
import type { Role } from '@/types';

const VARIANTS: Record<Role, BadgeVariant> = {
  OWNER: 'primary',
  ADMIN: 'info',
  MANAGER: 'success',
  MEMBER: 'neutral',
  VIEWER: 'outline',
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant={VARIANTS[role]}>
      {role === 'OWNER' && <Crown aria-hidden="true" className="size-3" />}
      {role === 'ADMIN' && <Shield aria-hidden="true" className="size-3" />}
      {ROLE_LABELS[role]}
    </Badge>
  );
}
