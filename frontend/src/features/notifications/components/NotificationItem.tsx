import { Check } from 'lucide-react';
import { Link } from 'react-router';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { Notification } from '@/types';
import { formatDateTime, formatRelativeTime } from '@/utils/date';

import { useMarkNotificationRead } from '../api/notifications.queries';
import { NOTIFICATION_TYPE_META, notificationHref } from '../notification-meta';

interface NotificationItemProps {
  notification: Notification;
  /** Called after navigating (e.g. to close the popover). */
  onNavigate?: () => void;
}

export function NotificationItem({ notification, onNavigate }: NotificationItemProps) {
  const markRead = useMarkNotificationRead();
  const unread = !notification.readAt;
  const href = notificationHref(notification);
  const Icon = NOTIFICATION_TYPE_META[notification.type].icon;

  const content = (
    <>
      <span className="relative shrink-0">
        {notification.actor ? (
          <Avatar
            name={notification.actor.name}
            src={notification.actor.avatarUrl}
            size="md"
            decorative
          />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
            <Icon aria-hidden="true" className="size-4" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-sm',
            unread ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}
        >
          {unread && <span className="sr-only">Unread: </span>}
          {notification.title}
        </span>
        {notification.body && (
          <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">
            {notification.body}
          </span>
        )}
        <time
          dateTime={notification.createdAt}
          title={formatDateTime(notification.createdAt)}
          className="mt-1 block text-xs text-muted-foreground"
        >
          {formatRelativeTime(notification.createdAt)}
        </time>
      </span>
    </>
  );

  const onOpen = () => {
    if (unread) markRead.mutate(notification.id);
    onNavigate?.();
  };

  return (
    <li
      className={cn(
        'group relative flex items-start gap-2 px-3 py-3',
        unread && 'bg-primary-soft/30',
      )}
    >
      {href ? (
        <Link
          to={href}
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-md outline-offset-4"
        >
          {content}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-3">{content}</div>
      )}
      <div className="flex shrink-0 flex-col items-center gap-2 pt-1">
        {unread ? (
          <>
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-primary group-focus-within:hidden group-hover:hidden"
            />
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Mark “${notification.title}” as read`}
              onClick={() => markRead.mutate(notification.id)}
              className="hidden text-muted-foreground group-focus-within:inline-flex group-hover:inline-flex"
            >
              <Check />
            </Button>
          </>
        ) : null}
      </div>
    </li>
  );
}
