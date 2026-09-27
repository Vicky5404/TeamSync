import type { ISODate } from './api';
import type { ProjectStatus } from './project';
import type { TaskPriority, TaskStatus } from './task';
import type { UserSummary } from './user';

export interface DashboardSummary {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  assignedToMe: number;
  dueThisWeek: number;
}

export interface CompletionPoint {
  date: ISODate;
  created: number;
  completed: number;
}

export const COMPLETION_RANGES = [7, 14, 30, 90] as const;
export type CompletionRange = (typeof COMPLETION_RANGES)[number];

export interface WorkloadEntry {
  member: UserSummary;
  todo: number;
  inProgress: number;
  review: number;
}

export interface ProjectProgressEntry {
  id: string;
  name: string;
  key: string;
  status: ProjectStatus;
  progress: number;
  dueDate: ISODate | null;
  totalTasks: number;
  completedTasks: number;
}

export interface ProjectAnalytics {
  byStatus: Array<{ status: TaskStatus; count: number }>;
  byPriority: Array<{ priority: TaskPriority; count: number }>;
  completionTrend: CompletionPoint[];
  workload: WorkloadEntry[];
  summary: {
    total: number;
    completed: number;
    overdue: number;
    averageCycleTimeDays: number | null;
  };
}
