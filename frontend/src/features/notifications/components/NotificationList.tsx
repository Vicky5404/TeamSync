import { BellOff } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton';
import type { NotificationFilter } from '@/types';
import { groupByDate } from '@/utils/date';

import { useNotifications } from '../api/notifications.queries';
import { NotificationItem } from './NotificationItem';

interface NotificationListProps {
  filter: NotificationFilter;
  onNavigate?: () => void;
  /** Limit the number of rendered items (popover preview). */
  limit?: number;
  compact?: boolean;
}

/** Notifications grouped by day (Today, Yesterday, This week, Earlier). */
export function NotificationList({
  filter,
  onNavigate,
  limit,
  compact = false,
}: NotificationListProps) {
  const notifications = useNotifications(filter);

  if (notifications.isPending) {
    return (
      <SkeletonGroup label="Loading notifications" className="space-y-4 p-3">
        {Array.from({ length: compact ? 4 : 6 }, (_, index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </SkeletonGroup>
    );
  }

  if (notifications.isError) {
    return (
      <ErrorState
        error={notifications.error}
        onRetry={() => void notifications.refetch()}
        retrying={notifications.isFetching}
        size="sm"
      />
    );
  }

  const all = notifications.data.pages.flatMap((page) => page.data);
  const items = limit ? all.slice(0, limit) : all;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<BellOff />}
        title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
        description={
          filter === 'unread'
            ? "You're all caught up."
            : "We'll let you know when something needs your attention."
        }
        size="sm"
      />
    );
  }

  const groups = groupByDate(items, (item) => item.createdAt);

  return (
    <div>
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h3 className="sticky top-0 z-10 bg-surface-raised/95 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            {group.label}
          </h3>
          <ul className="divide-y">
            {group.items.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </section>
      ))}
      {!limit && notifications.hasNextPage && (
        <div className="p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => void notifications.fetchNextPage()}
            loading={notifications.isFetchingNextPage}
          >
            Load older notifications
          </Button>
        </div>
      )}
    </div>
  );
}
