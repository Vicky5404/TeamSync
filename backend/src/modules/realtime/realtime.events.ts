/**
 * Server → client WebSocket events. Wire names match the web client's
 * `lib/realtime/events.ts`; keep both in sync.
 */
export const RealtimeEvent = {
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_MOVED: 'task.moved',
  TASK_DELETED: 'task.deleted',
  COMMENT_CREATED: 'comment.created',
  NOTIFICATION_CREATED: 'notification.created',
  MEMBER_UPDATED: 'member.updated',
  PROJECT_UPDATED: 'project.updated',
  REPORT_READY: 'report.ready',
} as const;

export type RealtimeEventType = (typeof RealtimeEvent)[keyof typeof RealtimeEvent];

/** Subscription channels. Clients may only join channels they are authorized for. */
export const Channels = {
  organization: (organizationId: string) => `organization:${organizationId}`,
  project: (projectId: string) => `project:${projectId}`,
  /** Private per-user channel (notifications); joined automatically after auth. */
  user: (userId: string) => `user:${userId}`,
} as const;

/** Messages exchanged between API instances / workers over Redis pub/sub. */
export type RealtimeMessage =
  | { kind: 'event'; type: RealtimeEventType; channels: string[]; payload: unknown }
  /** Drop a user's subscriptions to an organization's channels (membership removed). */
  | { kind: 'revoke'; userId: string; organizationId: string }
  /** Close sockets authenticated with these device sessions (logout, revocation, password change). */
  | { kind: 'revoke-sessions'; sessionIds: string[] };
