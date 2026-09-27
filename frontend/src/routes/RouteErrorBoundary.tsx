import { RefreshCw, TriangleAlert } from 'lucide-react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { Button } from '@/components/ui/Button';
import { buttonStyles } from '@/components/ui/button-styles';
import { env } from '@/lib/env';

import { NotFoundPage } from './NotFoundPage';
import { paths } from './paths';

/** A lazily loaded chunk failed to load — usually a new deployment replaced it. */
function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
      error.message,
    )
  );
}

/** Last-resort error UI for anything thrown while rendering or loading a route. */
export function RouteErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  const chunkError = isChunkLoadError(error);
  if (!chunkError) console.error('[route error]', error);

  return (
    <div role="alert" className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
          <TriangleAlert aria-hidden="true" className="size-6" />
        </div>
        <h1 className="text-xl font-semibold">
          {chunkError ? 'A new version is available' : 'Something went wrong'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {chunkError
            ? 'FlowSync was updated while you were using it. Reload the page to continue.'
            : 'An unexpected error occurred. Try reloading the page — if the problem persists, contact support.'}
        </p>
        {env.isDev && error instanceof Error && !chunkError && (
          <pre className="max-h-48 overflow-auto rounded-lg bg-surface-muted p-3 text-left text-xs">
            {error.stack ?? error.message}
          </pre>
        )}
        <div className="flex justify-center gap-2">
          <Button leftIcon={<RefreshCw />} onClick={() => window.location.reload()}>
            Reload page
          </Button>
          {!chunkError && (
            <Link to={paths.root} reloadDocument className={buttonStyles({ variant: 'outline' })}>
              Go home
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
