import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useProjectActivity } from '@/features/activity/api/activity.queries';
import { ActivityFeed } from '@/features/activity/components/ActivityFeed';

import { useProjectContext } from '../project-context';

export function ProjectActivityPage() {
  const { project } = useProjectContext();
  const activity = useProjectActivity(project.id);

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Activity</CardTitle>
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
          skeletonRows={8}
        />
      </CardContent>
    </Card>
  );
}
