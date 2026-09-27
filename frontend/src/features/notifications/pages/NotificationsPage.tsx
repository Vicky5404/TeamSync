import { CheckCheck, Settings } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { buttonStyles } from '@/components/ui/button-styles';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { paths } from '@/routes/paths';
import { readEnum, withParams } from '@/utils/search-params';

import { useMarkAllNotificationsRead, useUnreadCount } from '../api/notifications.queries';
import { NotificationList } from '../components/NotificationList';

const FILTERS = ['all', 'unread'] as const;

export function NotificationsPage() {
  useDocumentTitle('Notifications');
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = readEnum(searchParams, 'filter', FILTERS) ?? 'all';
  const unread = useUnreadCount();
  const markAll = useMarkAllNotificationsRead();
  const count = unread.data ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Notifications"
        description={
          count > 0
            ? `You have ${count} unread notification${count === 1 ? '' : 's'}.`
            : "You're all caught up."
        }
        actions={
          <>
            <Link
              to={paths.settingsNotifications}
              className={buttonStyles({ variant: 'outline', size: 'sm' })}
            >
              <Settings />
              Preferences
            </Link>
            <Button
              size="sm"
              leftIcon={<CheckCheck />}
              onClick={() => markAll.mutate()}
              loading={markAll.isPending}
              disabled={count === 0}
            >
              Mark all as read
            </Button>
          </>
        }
      />

      <SegmentedControl
        label="Filter notifications"
        size="md"
        value={filter}
        onValueChange={(next) =>
          setSearchParams(
            (current) => withParams(current, { filter: next === 'all' ? null : next }),
            {
              replace: true,
            },
          )
        }
        options={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: count > 0 ? `Unread (${count})` : 'Unread' },
        ]}
      />

      <Card className="overflow-hidden">
        <NotificationList filter={filter} />
      </Card>
    </div>
  );
}
