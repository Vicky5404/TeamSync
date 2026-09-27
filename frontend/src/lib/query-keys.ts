import type {
  CompletionRange,
  MemberListParams,
  NotificationFilter,
  OrganizationTaskListParams,
  ProjectListParams,
  TaskFilters,
} from '@/types';

/**
 * Centralized TanStack Query key factory.
 *
 * Keys are hierarchical so related caches can be invalidated with a prefix,
 * e.g. `queryKeys.tasks.lists()` matches every project and organization task list.
 */
export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
  },

  users: {
    sessions: () => ['users', 'me', 'sessions'] as const,
  },

  organizations: {
    all: () => ['organizations'] as const,
    list: () => ['organizations', 'list'] as const,
    members: (organizationId: string) => ['organizations', organizationId, 'members'] as const,
    memberList: (organizationId: string, params: MemberListParams) =>
      ['organizations', organizationId, 'members', 'list', params] as const,
    member: (organizationId: string, memberId: string) =>
      ['organizations', organizationId, 'members', 'detail', memberId] as const,
    invitations: (organizationId: string) =>
      ['organizations', organizationId, 'invitations'] as const,
    labels: (organizationId: string) => ['organizations', organizationId, 'labels'] as const,
    activity: (organizationId: string, actorId?: string) =>
      ['organizations', organizationId, 'activity', actorId ?? 'all'] as const,
  },

  projects: {
    all: () => ['projects'] as const,
    lists: (organizationId: string) => ['projects', 'list', organizationId] as const,
    list: (organizationId: string, params: ProjectListParams) =>
      ['projects', 'list', organizationId, params] as const,
    detail: (projectId: string) => ['projects', 'detail', projectId] as const,
    activity: (projectId: string) => ['projects', 'activity', projectId] as const,
  },

  tasks: {
    all: () => ['tasks'] as const,
    /** Prefix for every task collection (project and organization scoped). */
    lists: () => ['tasks', 'list'] as const,
    projectLists: (projectId: string) => ['tasks', 'list', 'project', projectId] as const,
    projectList: (projectId: string, filters: TaskFilters) =>
      ['tasks', 'list', 'project', projectId, filters] as const,
    organizationLists: (organizationId: string) =>
      ['tasks', 'list', 'organization', organizationId] as const,
    organizationList: (organizationId: string, params: OrganizationTaskListParams) =>
      ['tasks', 'list', 'organization', organizationId, params] as const,
    detail: (taskId: string) => ['tasks', 'detail', taskId] as const,
    activity: (taskId: string) => ['tasks', 'activity', taskId] as const,
  },

  comments: {
    list: (taskId: string) => ['comments', taskId] as const,
  },

  attachments: {
    list: (taskId: string) => ['attachments', taskId] as const,
  },

  notifications: {
    all: () => ['notifications'] as const,
    lists: () => ['notifications', 'list'] as const,
    list: (filter: NotificationFilter) => ['notifications', 'list', filter] as const,
    unreadCount: () => ['notifications', 'unread-count'] as const,
    preferences: () => ['notifications', 'preferences'] as const,
  },

  analytics: {
    all: () => ['analytics'] as const,
    dashboard: (organizationId: string) => ['analytics', organizationId, 'dashboard'] as const,
    completion: (organizationId: string, days: CompletionRange) =>
      ['analytics', organizationId, 'completion', days] as const,
    workload: (organizationId: string) => ['analytics', organizationId, 'workload'] as const,
    projectProgress: (organizationId: string) =>
      ['analytics', organizationId, 'project-progress'] as const,
    project: (projectId: string) => ['analytics', 'project', projectId] as const,
  },

  search: (organizationId: string, query: string) => ['search', organizationId, query] as const,
};
