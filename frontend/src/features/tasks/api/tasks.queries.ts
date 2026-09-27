import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { tasksService } from '@/services';
import type {
  ChecklistItem,
  CreateTaskInput,
  OrganizationTaskListParams,
  Task,
  TaskDetail,
  TaskFilters,
  TaskStatus,
  UpdateTaskInput,
} from '@/types';

import {
  findCachedTask,
  invalidateTaskDerivedData,
  patchTaskInCaches,
  removeTaskFromCaches,
  restoreTaskCaches,
  snapshotTaskCaches,
  taskMutationKeys,
  type TaskCacheSnapshot,
} from './task-cache';

// Queries -------------------------------------------------------------------

export function useProjectTasks(projectId: string, filters: TaskFilters) {
  return useQuery({
    queryKey: queryKeys.tasks.projectList(projectId, filters),
    queryFn: ({ signal }) => tasksService.listByProject(projectId, filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useOrganizationTasks(
  organizationId: string,
  params: OrganizationTaskListParams,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.tasks.organizationList(organizationId, params),
    queryFn: ({ signal }) => tasksService.listByOrganization(organizationId, params, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(taskId ?? ''),
    queryFn: ({ signal }) => tasksService.get(taskId ?? '', signal),
    enabled: Boolean(taskId),
  });
}

export function useTaskActivity(taskId: string) {
  return useQuery({
    queryKey: queryKeys.tasks.activity(taskId),
    queryFn: ({ signal }) => tasksService.listActivity(taskId, signal),
  });
}

// Mutations -----------------------------------------------------------------

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => tasksService.create(projectId, input),
    meta: { errorToast: false },
    onSuccess: () => invalidateTaskDerivedData(queryClient, projectId),
  });
}

interface UpdateTaskVariables {
  taskId: string;
  input: UpdateTaskInput;
  /**
   * Display values for the optimistic update (e.g. the assignee object for an
   * `assigneeId` change) so the UI updates before the server responds.
   */
  optimistic?: Partial<Task>;
}

function applyScalarUpdate(task: Task, input: UpdateTaskInput, optimistic?: Partial<Task>): Task {
  const next: Task = { ...task, ...optimistic };
  if (input.title !== undefined) next.title = input.title;
  if (input.description !== undefined) next.description = input.description;
  if (input.status !== undefined) next.status = input.status;
  if (input.priority !== undefined) next.priority = input.priority;
  if (input.dueDate !== undefined) next.dueDate = input.dueDate;
  if (input.assigneeId === null) next.assignee = null;
  return next;
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation<TaskDetail, Error, UpdateTaskVariables, TaskCacheSnapshot>({
    mutationKey: taskMutationKeys.update(),
    mutationFn: ({ taskId, input }) => tasksService.update(taskId, input),
    onMutate: async ({ taskId, input, optimistic }) => {
      const snapshot = await snapshotTaskCaches(queryClient);
      patchTaskInCaches(queryClient, taskId, (task) => applyScalarUpdate(task, input, optimistic));
      return snapshot;
    },
    onError: (_error, _variables, snapshot) => restoreTaskCaches(queryClient, snapshot),
    onSuccess: (task) => {
      const { checklistItems: _checklistItems, ...summary } = task;
      queryClient.setQueryData(queryKeys.tasks.detail(task.id), task);
      patchTaskInCaches(queryClient, task.id, (current) => ({ ...current, ...summary }));
    },
    onSettled: (task, _error, { taskId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.activity(taskId) });
      invalidateTaskDerivedData(queryClient, task?.project.id);
    },
  });
}

interface MoveTaskVariables {
  taskId: string;
  status: TaskStatus;
  position: number;
}

function isLastPendingMove(queryClient: QueryClient, projectId: string) {
  return queryClient.isMutating({ mutationKey: taskMutationKeys.move(projectId) }) === 1;
}

type BoardPlacement = Pick<Task, 'status' | 'position' | 'completedAt'>;

/**
 * Kanban move with optimistic UI: the card lands in its new column instantly.
 * A failed move reverts only that card (other in-flight moves keep their
 * optimistic state) and the board is reconciled with the server once the last
 * queued move settles, so rapid consecutive drags never flicker. The caller
 * reports failures (no global toast).
 */
export function useMoveTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<Task, Error, MoveTaskVariables, { previous: BoardPlacement | undefined }>({
    mutationKey: taskMutationKeys.move(projectId),
    mutationFn: ({ taskId, status, position }) => tasksService.move(taskId, { status, position }),
    meta: { errorToast: false },
    onMutate: async ({ taskId, status, position }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all() });
      const current = findCachedTask(queryClient, taskId);
      const now = new Date().toISOString();
      patchTaskInCaches(queryClient, taskId, (task) => ({
        ...task,
        status,
        position,
        completedAt: status === 'DONE' ? (task.completedAt ?? now) : null,
      }));
      return {
        previous: current && {
          status: current.status,
          position: current.position,
          completedAt: current.completedAt,
        },
      };
    },
    onError: (_error, { taskId }, context) => {
      const previous = context?.previous;
      if (previous) patchTaskInCaches(queryClient, taskId, (task) => ({ ...task, ...previous }));
    },
    onSettled: (_task, _error, { taskId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.activity(taskId) });
      if (isLastPendingMove(queryClient, projectId)) {
        invalidateTaskDerivedData(queryClient, projectId);
      }
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; projectId: string }) => tasksService.delete(taskId),
    onSuccess: (_result, { taskId, projectId }) => {
      removeTaskFromCaches(queryClient, taskId);
      invalidateTaskDerivedData(queryClient, projectId);
    },
  });
}

// Checklist -----------------------------------------------------------------

function patchChecklist(
  queryClient: QueryClient,
  taskId: string,
  update: (items: ChecklistItem[]) => ChecklistItem[],
) {
  let summary: Task['checklist'] | null = null;
  queryClient.setQueryData<TaskDetail>(queryKeys.tasks.detail(taskId), (task) => {
    if (!task) return task;
    const checklistItems = update(task.checklistItems);
    summary = {
      total: checklistItems.length,
      completed: checklistItems.filter((item) => item.completed).length,
    };
    return { ...task, checklistItems, checklist: summary };
  });
  if (summary) {
    const checklist = summary;
    patchTaskInCaches(queryClient, taskId, (task) => ({ ...task, checklist }));
  }
}

export function useAddChecklistItem(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => tasksService.addChecklistItem(taskId, { title }),
    onSuccess: (item) => patchChecklist(queryClient, taskId, (items) => [...items, item]),
  });
}

export function useUpdateChecklistItem(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    ChecklistItem,
    Error,
    { itemId: string; title?: string; completed?: boolean },
    TaskCacheSnapshot
  >({
    mutationFn: ({ itemId, ...input }) => tasksService.updateChecklistItem(taskId, itemId, input),
    onMutate: async ({ itemId, ...input }) => {
      const snapshot = await snapshotTaskCaches(queryClient);
      patchChecklist(queryClient, taskId, (items) =>
        items.map((item) => (item.id === itemId ? { ...item, ...input } : item)),
      );
      return snapshot;
    },
    onError: (_error, _variables, snapshot) => restoreTaskCaches(queryClient, snapshot),
  });
}

export function useDeleteChecklistItem(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string, TaskCacheSnapshot>({
    mutationFn: (itemId) => tasksService.deleteChecklistItem(taskId, itemId),
    onMutate: async (itemId) => {
      const snapshot = await snapshotTaskCaches(queryClient);
      patchChecklist(queryClient, taskId, (items) => items.filter((item) => item.id !== itemId));
      return snapshot;
    },
    onError: (_error, _variables, snapshot) => restoreTaskCaches(queryClient, snapshot),
  });
}

/**
 * Adjust comment/attachment counters on cached task cards. Call it *before* the
 * request (optimistically) and undo on failure: the API broadcasts the absolute
 * counts via `task.updated`, which may arrive before the HTTP response, so a
 * delta applied afterwards would double count.
 */
export function useTaskCounterUpdater() {
  const queryClient = useQueryClient();
  return (taskId: string, field: 'commentCount' | 'attachmentCount', delta: number) =>
    patchTaskInCaches(queryClient, taskId, (task) => ({
      ...task,
      [field]: Math.max(0, task[field] + delta),
    }));
}
