import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import type { Paginated, Task, TaskDetail } from '@/types';

type TaskCollection = Task[] | Paginated<Task>;

function isPaginated(data: TaskCollection): data is Paginated<Task> {
  return !Array.isArray(data);
}

function mapCollection(
  data: TaskCollection | undefined,
  update: (task: Task) => Task | null,
): TaskCollection | undefined {
  if (!data) return data;
  const apply = (tasks: Task[]) =>
    tasks.flatMap((task) => {
      const next = update(task);
      return next ? [next] : [];
    });
  if (isPaginated(data)) {
    const tasks = apply(data.data);
    const removed = data.data.length - tasks.length;
    return { ...data, data: tasks, meta: { ...data.meta, total: data.meta.total - removed } };
  }
  return apply(data);
}

export type TaskCacheSnapshot = Array<[QueryKey, unknown]>;

/** Cancel in-flight task queries and capture their state for rollback. */
export async function snapshotTaskCaches(queryClient: QueryClient): Promise<TaskCacheSnapshot> {
  await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all() });
  return queryClient.getQueriesData({ queryKey: queryKeys.tasks.all() });
}

export function restoreTaskCaches(
  queryClient: QueryClient,
  snapshot: TaskCacheSnapshot | undefined,
) {
  snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
}

/** Apply a patch to a task everywhere it is cached (lists + detail). */
export function patchTaskInCaches(
  queryClient: QueryClient,
  taskId: string,
  patch: (task: Task) => Task,
): void {
  queryClient.setQueriesData<TaskCollection>({ queryKey: queryKeys.tasks.lists() }, (data) =>
    mapCollection(data, (task) => (task.id === taskId ? patch(task) : task)),
  );
  queryClient.setQueryData<TaskDetail>(queryKeys.tasks.detail(taskId), (task) =>
    task ? { ...task, ...patch(task) } : task,
  );
}

/** Find the cached copy of a task (any list or its detail). */
export function findCachedTask(queryClient: QueryClient, taskId: string): Task | undefined {
  const detail = queryClient.getQueryData<TaskDetail>(queryKeys.tasks.detail(taskId));
  if (detail) return detail;
  for (const [, data] of queryClient.getQueriesData<TaskCollection>({
    queryKey: queryKeys.tasks.lists(),
  })) {
    const tasks = data ? (isPaginated(data) ? data.data : data) : [];
    const task = tasks.find((item) => item.id === taskId);
    if (task) return task;
  }
  return undefined;
}

/** Mutation keys of task mutations whose variables carry a `taskId`. */
export const taskMutationKeys = {
  update: () => ['tasks', 'update'] as const,
  move: (projectId: string) => ['tasks', 'move', projectId] as const,
};

/** True while this client has an unsettled update/move for the task (its own echo would flicker). */
export function hasPendingTaskMutation(queryClient: QueryClient, taskId: string): boolean {
  return (
    queryClient.isMutating({
      mutationKey: queryKeys.tasks.all(),
      predicate: (mutation) =>
        (mutation.state.variables as { taskId?: unknown } | undefined)?.taskId === taskId,
    }) > 0
  );
}

const isUnfiltered = (key: QueryKey) => {
  const filters = key[4];
  return typeof filters !== 'object' || filters === null || Object.keys(filters).length === 0;
};

/**
 * Put a task created/changed elsewhere into its project's board caches without
 * refetching: unfiltered lists get the task inserted or replaced in place; lists
 * with active filters are refetched because membership depends on the filters.
 */
export function upsertTaskInProjectLists(queryClient: QueryClient, task: Task): void {
  const queryKey = queryKeys.tasks.projectLists(task.project.id);
  for (const [key, data] of queryClient.getQueriesData<Task[]>({ queryKey })) {
    if (!data) continue;
    if (!isUnfiltered(key)) {
      void queryClient.invalidateQueries({ queryKey: key, exact: true });
      continue;
    }
    const index = data.findIndex((item) => item.id === task.id);
    queryClient.setQueryData<Task[]>(
      key,
      index === -1 ? [...data, task] : data.map((item) => (item.id === task.id ? task : item)),
    );
  }
}

export function removeTaskFromCaches(queryClient: QueryClient, taskId: string): void {
  queryClient.setQueriesData<TaskCollection>({ queryKey: queryKeys.tasks.lists() }, (data) =>
    mapCollection(data, (task) => (task.id === taskId ? null : task)),
  );
  queryClient.removeQueries({ queryKey: queryKeys.tasks.detail(taskId) });
}

/** Invalidate everything derived from task state (lists, project stats, analytics). */
export function invalidateTaskDerivedData(queryClient: QueryClient, projectId?: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.lists() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all() });
  if (projectId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.projects.activity(projectId) });
  }
  // Project cards show progress; mark them stale without refetching immediately.
  void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all(), refetchType: 'none' });
}
