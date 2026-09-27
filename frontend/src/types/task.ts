import type { ISODate, ISODateTime, SortOrder } from './api';
import type { Label } from './label';
import type { UserSummary } from './user';

export const TASK_STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const DUE_PRESETS = ['overdue', 'today', 'this_week', 'next_7_days', 'no_date'] as const;
export type DuePreset = (typeof DUE_PRESETS)[number];

export interface TaskProjectRef {
  id: string;
  key: string;
  name: string;
}

export interface ChecklistSummary {
  total: number;
  completed: number;
}

export interface Task {
  id: string;
  /** Human-readable identifier, e.g. `WEB-42`. */
  identifier: string;
  project: TaskProjectRef;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** Fractional ordering key within a status column (ascending). */
  position: number;
  assignee: UserSummary | null;
  reporter: UserSummary;
  dueDate: ISODate | null;
  labels: Label[];
  commentCount: number;
  attachmentCount: number;
  checklist: ChecklistSummary;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  completedAt: ISODateTime | null;
}

export interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  position: number;
}

export interface TaskDetail extends Task {
  checklistItems: ChecklistItem[];
}

/** Filters shared by project task lists and the organization-wide task search. */
export interface TaskFilters {
  search?: string;
  status?: TaskStatus[];
  priority?: TaskPriority[];
  /** User ids; the literals `me` and `unassigned` are also accepted. */
  assignee?: string[];
  labels?: string[];
  due?: DuePreset;
  dueFrom?: ISODate;
  dueTo?: ISODate;
}

export const TASK_SORT_FIELDS = [
  'title',
  'status',
  'priority',
  'dueDate',
  'createdAt',
  'updatedAt',
] as const;
export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

export interface OrganizationTaskListParams extends TaskFilters {
  projectId?: string;
  sort?: TaskSortField;
  order?: SortOrder;
  page?: number;
  pageSize?: number;
}

export interface CreateTaskInput {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate: ISODate | null;
  labelIds: string[];
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

export interface MoveTaskInput {
  status: TaskStatus;
  position: number;
}

export interface CreateChecklistItemInput {
  title: string;
}

export interface UpdateChecklistItemInput {
  title?: string;
  completed?: boolean;
}
