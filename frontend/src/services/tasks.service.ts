import { http } from '@/lib/http';
import type {
  Activity,
  ChecklistItem,
  CreateChecklistItemInput,
  CreateTaskInput,
  MoveTaskInput,
  OrganizationTaskListParams,
  Paginated,
  Task,
  TaskDetail,
  TaskFilters,
  UpdateChecklistItemInput,
  UpdateTaskInput,
} from '@/types';

export const tasksService = {
  /** All tasks of a project matching the filters (used by board & list views). */
  listByProject: async (
    projectId: string,
    filters: TaskFilters = {},
    signal?: AbortSignal,
  ): Promise<Task[]> =>
    (await http.get<Task[]>(`/projects/${projectId}/tasks`, { params: filters, signal })).data,

  /** Paginated, organization-wide task search (My tasks, dashboard widgets). */
  listByOrganization: async (
    organizationId: string,
    params: OrganizationTaskListParams = {},
    signal?: AbortSignal,
  ): Promise<Paginated<Task>> =>
    (
      await http.get<Paginated<Task>>(`/organizations/${organizationId}/tasks`, {
        params,
        signal,
      })
    ).data,

  get: async (taskId: string, signal?: AbortSignal): Promise<TaskDetail> =>
    (await http.get<TaskDetail>(`/tasks/${taskId}`, { signal })).data,

  create: async (projectId: string, input: CreateTaskInput): Promise<Task> =>
    (await http.post<Task>(`/projects/${projectId}/tasks`, input)).data,

  update: async (taskId: string, input: UpdateTaskInput): Promise<TaskDetail> =>
    (await http.patch<TaskDetail>(`/tasks/${taskId}`, input)).data,

  /** Change status and/or ordering (Kanban drag & drop). */
  move: async (taskId: string, input: MoveTaskInput): Promise<Task> =>
    (await http.post<Task>(`/tasks/${taskId}/move`, input)).data,

  delete: async (taskId: string): Promise<void> => {
    await http.delete(`/tasks/${taskId}`);
  },

  listActivity: async (taskId: string, signal?: AbortSignal): Promise<Activity[]> =>
    (await http.get<Activity[]>(`/tasks/${taskId}/activity`, { signal })).data,

  // Checklist ---------------------------------------------------------------

  addChecklistItem: async (
    taskId: string,
    input: CreateChecklistItemInput,
  ): Promise<ChecklistItem> =>
    (await http.post<ChecklistItem>(`/tasks/${taskId}/checklist`, input)).data,

  updateChecklistItem: async (
    taskId: string,
    itemId: string,
    input: UpdateChecklistItemInput,
  ): Promise<ChecklistItem> =>
    (await http.patch<ChecklistItem>(`/tasks/${taskId}/checklist/${itemId}`, input)).data,

  deleteChecklistItem: async (taskId: string, itemId: string): Promise<void> => {
    await http.delete(`/tasks/${taskId}/checklist/${itemId}`);
  },
};
