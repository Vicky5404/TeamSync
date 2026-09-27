import type { QueryClient } from '@tanstack/react-query';

import type { RealtimeRegistration } from '@/lib/realtime/RealtimeProvider';
import { queryKeys } from '@/lib/query-keys';
import type { Task } from '@/types';

import {
  findCachedTask,
  hasPendingTaskMutation,
  patchTaskInCaches,
  removeTaskFromCaches,
  upsertTaskInProjectLists,
} from './api/task-cache';

/** Bursts of events (e.g. a teammate dragging cards around) cause one refresh. */
const DERIVED_REFRESH_DELAY_MS = 1_000;

/**
 * Batches refreshes of data derived from task state — analytics, project
 * progress/counts and the paginated organization-wide lists. Only queries that
 * are on screen refetch; the rest are just marked stale.
 */
function createDerivedRefresher(queryClient: QueryClient) {
  const projectIds = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    timer = undefined;
    void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all() });
    void queryClient.invalidateQueries({ queryKey: [...queryKeys.tasks.lists(), 'organization'] });
    void queryClient.invalidateQueries({ queryKey: [...queryKeys.projects.all(), 'list'] });
    for (const projectId of projectIds) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    }
    projectIds.clear();
  };

  return {
    schedule: (projectId: string) => {
      projectIds.add(projectId);
      timer ??= setTimeout(flush, DERIVED_REFRESH_DELAY_MS);
    },
    dispose: () => clearTimeout(timer),
  };
}

/** Fields that decide which filtered lists a task belongs to and what analytics count. */
function filterFieldsChanged(previous: Task, next: Task): boolean {
  const labelIds = (task: Task) =>
    task.labels
      .map((label) => label.id)
      .sort()
      .join();
  return (
    previous.status !== next.status ||
    previous.priority !== next.priority ||
    (previous.assignee?.id ?? null) !== (next.assignee?.id ?? null) ||
    previous.dueDate !== next.dueDate ||
    previous.title !== next.title ||
    previous.description !== next.description ||
    labelIds(previous) !== labelIds(next)
  );
}

/**
 * Keep boards, lists and open task drawers in sync with changes made by
 * teammates, writing event payloads straight into the cache. Refetches are
 * limited to filtered lists whose membership may have changed and to batched,
 * on-screen derived data.
 */
export const registerTaskRealtime: RealtimeRegistration = (client, queryClient) => {
  const derived = createDerivedRefresher(queryClient);

  const applyTaskChange = (task: Task) => {
    // Echo of this client's own in-flight change: its mutation reconciles when it settles.
    if (hasPendingTaskMutation(queryClient, task.id)) return;
    const previous = findCachedTask(queryClient, task.id);
    patchTaskInCaches(queryClient, task.id, (current) => ({ ...current, ...task }));
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.activity(task.id) });
    // Title edits and comment/attachment counters don't change list membership or analytics.
    if (!previous || filterFieldsChanged(previous, task)) {
      upsertTaskInProjectLists(queryClient, task);
      derived.schedule(task.project.id);
    }
  };

  const cleanups = [
    client.on('task.created', (task) => {
      upsertTaskInProjectLists(queryClient, task);
      derived.schedule(task.project.id);
    }),
    client.on('task.updated', applyTaskChange),
    client.on('task.moved', applyTaskChange),
    client.on('task.deleted', ({ id, projectId }) => {
      removeTaskFromCaches(queryClient, id);
      derived.schedule(projectId);
    }),
    client.on('project.updated', ({ id, deleted }) => {
      if (deleted) {
        queryClient.removeQueries({ queryKey: queryKeys.projects.detail(id) });
      } else {
        void queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id) });
      }
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.projects.all(), 'list'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all() });
    }),
  ];
  return () => {
    derived.dispose();
    cleanups.forEach((cleanup) => cleanup());
  };
};
