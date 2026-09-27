import type { ISODate, ISODateTime } from './api';
import type { UserSummary } from './user';

export const PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectTaskCounts {
  total: number;
  completed: number;
  overdue: number;
}

export interface Project {
  id: string;
  organizationId: string;
  /** Short uppercase key used to build task identifiers, e.g. `WEB` → `WEB-42`. */
  key: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  /** Completion percentage (0–100), computed by the API from task state. */
  progress: number;
  members: UserSummary[];
  taskCounts: ProjectTaskCounts;
  owner: UserSummary;
  startDate: ISODate | null;
  dueDate: ISODate | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export const PROJECT_SORTS = ['updated', 'name', 'dueDate', 'progress', 'created'] as const;
export type ProjectSort = (typeof PROJECT_SORTS)[number];

export interface ProjectListParams {
  search?: string;
  status?: ProjectStatus[];
  sort?: ProjectSort;
  page?: number;
  pageSize?: number;
}

export interface CreateProjectInput {
  name: string;
  key: string;
  description: string | null;
  status: ProjectStatus;
  startDate: ISODate | null;
  dueDate: ISODate | null;
  memberIds: string[];
}

export type UpdateProjectInput = Partial<CreateProjectInput>;
