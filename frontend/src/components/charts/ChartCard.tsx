import { ChartColumn, Table2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { StaleDataNotice } from '@/components/common/StaleDataNotice';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';

interface ChartCardProps {
  title: string;
  description?: string;
  /** Controls shown in the header (e.g. range selector). */
  actions?: ReactNode;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  isEmpty: boolean;
  emptyMessage?: string;
  /** True while refetching with previous data shown — dims instead of flashing a skeleton. */
  isRefreshing?: boolean;
  height?: number;
  chart: () => ReactNode;
  table: () => ReactNode;
  className?: string;
}

/**
 * Standard chart container: title, loading skeleton, error + retry, empty state,
 * and a chart/table toggle so every value is reachable without hovering.
 */
export function ChartCard({
  title,
  description,
  actions,
  isLoading,
  error,
  onRetry,
  isEmpty,
  emptyMessage = 'No data for this period yet.',
  isRefreshing = false,
  height = 260,
  chart,
  table,
  className,
}: ChartCardProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  // A failed background refresh keeps the last loaded data visible (partial data).
  const stale = Boolean(error) && !isEmpty;
  const showData = !isLoading && !isEmpty && (!error || stale);

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {showData && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
              aria-label={
                view === 'chart' ? `Show ${title} as a table` : `Show ${title} as a chart`
              }
              aria-pressed={view === 'table'}
              title={view === 'chart' ? 'View as table' : 'View as chart'}
            >
              {view === 'chart' ? <Table2 /> : <ChartColumn />}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <Skeleton style={{ height }} className="w-full rounded-lg" />
        ) : error && !stale ? (
          <ErrorState error={error} onRetry={onRetry} size="sm" />
        ) : isEmpty ? (
          <EmptyState
            icon={<ChartColumn />}
            title="Nothing to show yet"
            description={emptyMessage}
            size="sm"
          />
        ) : (
          <div
            className={cn('transition-opacity', isRefreshing && 'opacity-60')}
            aria-busy={isRefreshing || undefined}
          >
            {view === 'chart' ? chart() : table()}
            {stale && <StaleDataNotice error={error} onRetry={onRetry} className="mt-3" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
