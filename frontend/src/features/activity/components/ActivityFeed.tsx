import { Activity as ActivityIcon } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton';
import type { Activity } from '@/types';

import { ActivityItem } from './ActivityItem';

interface ActivityFeedProps {
  items: readonly Activity[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  showTarget?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  emptyMessage?: string;
  skeletonRows?: number;
}

export function ActivityFeed({
  items,
  isLoading,
  error,
  onRetry,
  showTarget = true,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  emptyMessage = 'Activity will show up here as your team works.',
  skeletonRows = 5,
}: ActivityFeedProps) {
  if (isLoading) {
    return (
      <SkeletonGroup label="Loading activity" className="space-y-4 py-2">
        {Array.from({ length: skeletonRows }, (_, index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="size-6 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </SkeletonGroup>
    );
  }

  if (error) return <ErrorState error={error} onRetry={onRetry} size="sm" />;

  if (!items?.length) {
    return (
      <EmptyState
        icon={<ActivityIcon />}
        title="No activity yet"
        description={emptyMessage}
        size="sm"
      />
    );
  }

  return (
    <div>
      <ol className="divide-y" aria-label="Activity">
        {items.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} showTarget={showTarget} />
        ))}
      </ol>
      {hasMore && onLoadMore && (
        <div className="pt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onLoadMore}
            loading={isLoadingMore}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
