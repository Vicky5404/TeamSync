import { Bell, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/Button';
import { Popover } from '@/components/ui/Popover';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { paths } from '@/routes/paths';
import type { NotificationFilter } from '@/types';

import { useMarkAllNotificationsRead, useUnreadCount } from '../api/notifications.queries';
import { NotificationList } from './NotificationList';

/** Top-bar notification center: unread badge + popover with the latest items. */
export function NotificationBell() {
  const unread = useUnreadCount();
  const markAll = useMarkAllNotificationsRead();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const count = unread.data ?? 0;
  const badge = count > 99 ? '99+' : String(count);

  return (
    <Popover
      label="Notifications"
      placement="bottom-end"
      className="flex max-h-[min(34rem,calc(100dvh-5rem))] w-[calc(100vw-1rem)] flex-col overflow-hidden sm:w-96"
      trigger={(props) => (
        <Button
          {...props}
          variant="ghost"
          size="icon"
          aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
          className="relative"
        >
          <Bell />
          {count > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-destructive-foreground"
            >
              {badge}
            </span>
          )}
        </Button>
      )}
    >
      {(close) => (
        <>
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <Button
              variant="ghost"
              size="xs"
              leftIcon={<CheckCheck />}
              onClick={() => markAll.mutate()}
              disabled={count === 0}
            >
              Mark all as read
            </Button>
          </div>
          <div className="border-b px-3 py-2">
            <SegmentedControl
              label="Show"
              value={filter}
              onValueChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'unread', label: count > 0 ? `Unread (${badge})` : 'Unread' },
              ]}
            />
          </div>
          <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
            <NotificationList filter={filter} onNavigate={close} limit={15} compact />
          </div>
          <div className="border-t p-2">
            <Link
              to={paths.notifications}
              onClick={close}
              className="block rounded-md py-1.5 text-center text-sm font-medium text-primary hover:bg-accent"
            >
              View all notifications
            </Link>
          </div>
        </>
      )}
    </Popover>
  );
}
