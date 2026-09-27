import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { searchService } from '@/services';

export const MIN_SEARCH_LENGTH = 2;

export function useGlobalSearch(organizationId: string, query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: queryKeys.search(organizationId, trimmed),
    queryFn: ({ signal }) => searchService.search(organizationId, trimmed, signal),
    enabled: trimmed.length >= MIN_SEARCH_LENGTH,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
