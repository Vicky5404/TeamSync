import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useState, type ReactNode } from 'react';

import { Toaster } from '@/components/ui/Toaster';
import { SessionManager } from '@/features/auth/components/SessionManager';

import { createQueryClient } from './query-client';
import { ThemeSync } from './ThemeSync';

// Devtools are only bundled for development builds.
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((module) => ({
        default: module.ReactQueryDevtools,
      })),
    )
  : null;

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionManager />
      <ThemeSync />
      {children}
      <Toaster />
      {ReactQueryDevtools && (
        <Suspense fallback={null}>
          <ReactQueryDevtools buttonPosition="bottom-right" />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}
