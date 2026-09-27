import { http } from '@/lib/http';
import type { SearchResults } from '@/types';

export const searchService = {
  search: async (
    organizationId: string,
    query: string,
    signal?: AbortSignal,
  ): Promise<SearchResults> =>
    (
      await http.get<SearchResults>(`/organizations/${organizationId}/search`, {
        params: { q: query, limit: 5 },
        signal,
      })
    ).data,
};
