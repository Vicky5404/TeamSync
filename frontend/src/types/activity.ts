import type { ISODateTime } from './api';
import type { UserSummary } from './user';

export const ACTIVITY_ACTIONS = [
  'task.created',
  'task.updated',
  'task.status_changed',
  'task.assigned',
  'task.completed',
  'task.commented',
  'task.attachment_added',
  'project.created',
  'project.updated',
  'member.joined',
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export interface ActivityTarget {
  type: 'task' | 'project' | 'member';
  id: string;
  name: string;
  /** Present for task targets so links can be built. */
  projectId?: string;
  identifier?: string;
}

export interface Activity {
  id: string;
  action: ActivityAction;
  actor: UserSummary;
  target: ActivityTarget;
  /** Action-specific details, e.g. `{ from: 'TODO', to: 'DONE' }`. */
  metadata: Record<string, string | null>;
  createdAt: ISODateTime;
}
