import { useInfiniteQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { organizationsService, projectsService } from '@/services';

const PAGE_SIZE = 15;

export function useOrganizationActivity(
  organizationId: string,
  { actorId, limit = PAGE_SIZE }: { actorId?: string; limit?: number } = {},
) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.organizations.activity(organizationId, actorId), limit],
    queryFn: ({ pageParam, signal }) =>
      organizationsService.listActivity(
        organizationId,
        { cursor: pageParam ?? undefined, limit, actorId },
        signal,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export function useProjectActivity(projectId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.projects.activity(projectId),
    queryFn: ({ pageParam, signal }) =>
      projectsService.listActivity(
        projectId,
        { cursor: pageParam ?? undefined, limit: PAGE_SIZE },
        signal,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
