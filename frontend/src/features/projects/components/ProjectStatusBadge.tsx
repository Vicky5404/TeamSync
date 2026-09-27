import { Badge } from '@/components/ui/Badge';
import type { ProjectStatus } from '@/types';

import { PROJECT_STATUS_META } from '../constants';

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const meta = PROJECT_STATUS_META[status];
  return (
    <Badge variant={meta.badge} dot>
      {meta.label}
    </Badge>
  );
}
