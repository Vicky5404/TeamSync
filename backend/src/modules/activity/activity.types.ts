/** Dotted activity action names. The first block matches the web client's `ACTIVITY_ACTIONS`. */
export const ActivityAction = {
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_STATUS_CHANGED: 'task.status_changed',
  TASK_ASSIGNED: 'task.assigned',
  TASK_COMPLETED: 'task.completed',
  TASK_COMMENTED: 'task.commented',
  TASK_ATTACHMENT_ADDED: 'task.attachment_added',
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  MEMBER_JOINED: 'member.joined',
  // Additional audit events (rendered generically by the current web client).
  TASK_DELETED: 'task.deleted',
  TASK_RESTORED: 'task.restored',
  PROJECT_DELETED: 'project.deleted',
  PROJECT_RESTORED: 'project.restored',
  PROJECT_MEMBER_ADDED: 'project.member_added',
  PROJECT_MEMBER_REMOVED: 'project.member_removed',
  MEMBER_INVITED: 'member.invited',
  MEMBER_ROLE_CHANGED: 'member.role_changed',
  MEMBER_REMOVED: 'member.removed',
  MEMBER_LEFT: 'member.left',
  ORGANIZATION_UPDATED: 'organization.updated',
} as const;

export type ActivityAction = (typeof ActivityAction)[keyof typeof ActivityAction];

/** Snapshot of what an activity refers to (kept even if the target is later deleted). */
export interface ActivityTarget {
  type: 'task' | 'project' | 'member' | 'organization';
  id: string;
  name: string;
  /** Present for task targets so links can be built. */
  projectId?: string;
  identifier?: string;
}

export type ActivityMetadata = Record<string, string | null>;

export interface ActivityEntry {
  organizationId: string;
  projectId?: string | null;
  taskId?: string | null;
  actorId: string | null;
  action: ActivityAction;
  target: ActivityTarget;
  metadata?: ActivityMetadata;
}

/** Task target helper, e.g. `{ type: 'task', identifier: 'WEB-42', … }`. */
export function taskTarget(task: {
  id: string;
  title: string;
  number: number;
  projectId: string;
  project: { key: string };
}): ActivityTarget {
  return {
    type: 'task',
    id: task.id,
    name: task.title,
    projectId: task.projectId,
    identifier: `${task.project.key}-${task.number}`,
  };
}
