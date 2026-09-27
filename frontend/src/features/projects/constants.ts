import type { BadgeVariant } from '@/components/ui/Badge';
import type { ProjectSort, ProjectStatus } from '@/types';

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; badge: BadgeVariant }> = {
  PLANNING: { label: 'Planning', badge: 'info' },
  ACTIVE: { label: 'Active', badge: 'primary' },
  ON_HOLD: { label: 'On hold', badge: 'warning' },
  COMPLETED: { label: 'Completed', badge: 'success' },
  ARCHIVED: { label: 'Archived', badge: 'neutral' },
};

export const PROJECT_SORT_LABELS: Record<ProjectSort, string> = {
  updated: 'Recently updated',
  created: 'Newest first',
  name: 'Name (A–Z)',
  dueDate: 'Due date',
  progress: 'Progress',
};
