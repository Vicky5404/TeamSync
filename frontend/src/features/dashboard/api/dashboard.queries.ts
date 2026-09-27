import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { analyticsService } from '@/services';
import type { CompletionRange } from '@/types';

export function useDashboardSummary(organizationId: string) {
  return useQuery({
    queryKey: queryKeys.analytics.dashboard(organizationId),
    queryFn: ({ signal }) => analyticsService.dashboard(organizationId, signal),
  });
}

export function useTaskCompletion(organizationId: string, days: CompletionRange) {
  return useQuery({
    queryKey: queryKeys.analytics.completion(organizationId, days),
    queryFn: ({ signal }) => analyticsService.taskCompletion(organizationId, days, signal),
    // Keep the previous series on screen while a new range loads.
    placeholderData: keepPreviousData,
  });
}

export function useTeamWorkload(organizationId: string) {
  return useQuery({
    queryKey: queryKeys.analytics.workload(organizationId),
    queryFn: ({ signal }) => analyticsService.workload(organizationId, signal),
  });
}

export function useProjectProgress(organizationId: string) {
  return useQuery({
    queryKey: queryKeys.analytics.projectProgress(organizationId),
    queryFn: ({ signal }) => analyticsService.projectProgress(organizationId, signal),
  });
}
