import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { Link, useMatches } from 'react-router';

import { cn } from '@/lib/cn';
import { isRouteHandle } from '@/routes/route-handle';

/** Breadcrumb trail built from `handle.crumb` on matched routes. */
export function Breadcrumbs({ className }: { className?: string }) {
  const matches = useMatches();
  const crumbs = matches.flatMap((match) =>
    isRouteHandle(match.handle) && match.handle.crumb
      ? [{ id: match.id, pathname: match.pathname, label: match.handle.crumb(match.params) }]
      : [],
  );

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <Fragment key={crumb.id}>
              <li
                className={cn(
                  'min-w-0',
                  // On small screens only the current page is shown.
                  !last && 'hidden sm:block',
                )}
              >
                {last ? (
                  <span aria-current="page" className="block truncate font-medium text-foreground">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    to={crumb.pathname}
                    className="block truncate text-muted-foreground hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
              {!last && (
                <li aria-hidden="true" className="hidden text-muted-foreground sm:block">
                  <ChevronRight className="size-3.5" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
