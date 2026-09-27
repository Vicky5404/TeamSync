import type { Comment, Member, Notification, Task } from '@/types';

/** A membership was added, changed or removed in an organization. */
export interface MemberUpdatedEvent {
  organizationId: string;
  action: 'joined' | 'updated' | 'removed';
  member?: Member;
  memberId?: string;
  userId?: string;
}

/**
 * Server → client events delivered over the WebSocket connection.
 * Keep in sync with the backend event contract (`backend/src/modules/realtime/realtime.events.ts`).
 */
export interface RealtimeEventMap {
  'notification.created': Notification;
  'task.created': Task;
  'task.updated': Task;
  /** Kanban move (status and/or position changed). */
  'task.moved': Task;
  'task.deleted': { id: string; projectId: string };
  'comment.created': Comment;
  /** Project created, changed, restored or (with `deleted`) moved to the trash. */
  'project.updated': { id: string; deleted?: boolean };
  'member.updated': MemberUpdatedEvent;
}

export type RealtimeEventType = keyof RealtimeEventMap;

export type RealtimeHandler<T extends RealtimeEventType> = (payload: RealtimeEventMap[T]) => void;

export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

/** Client → server control messages. */
export type RealtimeClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'subscribe'; channel: string }
  | { type: 'unsubscribe'; channel: string }
  | { type: 'ping' };
