import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';

import { ActiveOrganizationContext } from '@/features/organizations/active-organization';
import type { Organization } from '@/types';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export const testOrganization: Organization = {
  id: '0190f0a0-0000-7000-8000-000000000001',
  name: 'Acme',
  slug: 'acme',
  description: null,
  logoUrl: null,
  role: 'MEMBER',
  memberCount: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
};

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  organization?: Organization | null;
}

/** Render with a fresh QueryClient and (optionally) an active organization. */
export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient = createTestQueryClient(),
    organization = testOrganization,
    ...options
  }: RenderWithProvidersOptions = {},
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ActiveOrganizationContext.Provider value={organization}>
        {children}
      </ActiveOrganizationContext.Provider>
    </QueryClientProvider>
  );
  return { queryClient, ...render(ui, { wrapper, ...options }) };
}

/** Render routes in a memory router (for pages that navigate or read the location). */
export function renderRoutes(
  routes: RouteObject[],
  {
    initialEntries = ['/'],
    queryClient = createTestQueryClient(),
  }: {
    initialEntries?: Array<string | { pathname: string; state?: unknown }>;
    queryClient?: QueryClient;
  } = {},
) {
  const router = createMemoryRouter(routes, { initialEntries });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient, ...result };
}
