import { http } from '@/lib/http';
import type {
  CompletionPoint,
  CompletionRange,
  DashboardSummary,
  ProjectAnalytics,
  ProjectProgressEntry,
  WorkloadEntry,
} from '@/types';

const base = (organizationId: string) => `/organizations/${organizationId}/analytics`;

export const analyticsService = {
  dashboard: async (organizationId: string, signal?: AbortSignal): Promise<DashboardSummary> =>
    (await http.get<DashboardSummary>(`${base(organizationId)}/dashboard`, { signal })).data,

  taskCompletion: async (
    organizationId: string,
    days: CompletionRange,
    signal?: AbortSignal,
  ): Promise<CompletionPoint[]> =>
    (
      await http.get<CompletionPoint[]>(`${base(organizationId)}/task-completion`, {
        params: { days },
        signal,
      })
    ).data,

  workload: async (organizationId: string, signal?: AbortSignal): Promise<WorkloadEntry[]> =>
    (await http.get<WorkloadEntry[]>(`${base(organizationId)}/workload`, { signal })).data,

  projectProgress: async (
    organizationId: string,
    signal?: AbortSignal,
  ): Promise<ProjectProgressEntry[]> =>
    (await http.get<ProjectProgressEntry[]>(`${base(organizationId)}/project-progress`, { signal }))
      .data,

  project: async (projectId: string, signal?: AbortSignal): Promise<ProjectAnalytics> =>
    (await http.get<ProjectAnalytics>(`/projects/${projectId}/analytics`, { signal })).data,
};
