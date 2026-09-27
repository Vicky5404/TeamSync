import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useOrganizationActivity } from '@/features/activity/api/activity.queries';
import { ActivityFeed } from '@/features/activity/components/ActivityFeed';
import { useActiveOrganization } from '@/features/organizations/active-organization';

export function RecentActivityCard({ className }: { className?: string }) {
  const organization = useActiveOrganization();
  const activity = useOrganizationActivity(organization.id, { limit: 10 });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ActivityFeed
          items={activity.data?.pages.flatMap((page) => page.data)}
          isLoading={activity.isPending}
          error={activity.error}
          onRetry={() => void activity.refetch()}
          hasMore={activity.hasNextPage}
          onLoadMore={() => void activity.fetchNextPage()}
          isLoadingMore={activity.isFetchingNextPage}
        />
      </CardContent>
    </Card>
  );
}
