import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { analyticsService, projectsService } from '@/services';
import type {
  CreateProjectInput,
  Paginated,
  Project,
  ProjectListParams,
  UpdateProjectInput,
} from '@/types';

export function useProjects(organizationId: string, params: ProjectListParams = {}) {
  return useQuery({
    queryKey: queryKeys.projects.list(organizationId, params),
    queryFn: ({ signal }) => projectsService.list(organizationId, params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useProject(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId ?? ''),
    queryFn: ({ signal }) => projectsService.get(projectId ?? '', signal),
    enabled: Boolean(projectId),
    // Seed from any cached project list so headers render instantly.
    initialData: () => {
      if (!projectId) return undefined;
      for (const [, page] of queryClient.getQueriesData<Paginated<Project>>({
        queryKey: queryKeys.projects.all(),
      })) {
        const match =
          page && 'data' in page
            ? page.data.find((project) => project.id === projectId)
            : undefined;
        if (match) return match;
      }
      return undefined;
    },
    initialDataUpdatedAt: 0,
  });
}

export function useProjectAnalytics(projectId: string) {
  return useQuery({
    queryKey: queryKeys.analytics.project(projectId),
    queryFn: ({ signal }) => analyticsService.project(projectId, signal),
  });
}

export function useCreateProject(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsService.create(organizationId, input),
    meta: { errorToast: false },
    onSuccess: (project) => {
      queryClient.setQueryData(queryKeys.projects.detail(project.id), project);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists(organizationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all() });
    },
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => projectsService.update(projectId, input),
    meta: { errorToast: false },
    onSuccess: (project) => {
      queryClient.setQueryData(queryKeys.projects.detail(project.id), project);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.projects.lists(project.organizationId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.activity(project.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all() });
    },
  });
}

export function useDeleteProject(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => projectsService.delete(projectId),
    onSuccess: (_result, projectId) => {
      queryClient.removeQueries({ queryKey: queryKeys.projects.detail(projectId) });
      queryClient.removeQueries({ queryKey: queryKeys.tasks.projectLists(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists(organizationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all() });
    },
  });
}
