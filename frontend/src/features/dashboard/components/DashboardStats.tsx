import { CircleCheck, FolderKanban, ListTodo, TriangleAlert, UserCheck } from 'lucide-react';

import { StaleDataNotice } from '@/components/common/StaleDataNotice';
import { StatCard } from '@/components/common/StatCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { useActiveOrganization } from '@/features/organizations/active-organization';
import { formatPercent } from '@/utils/format';

import { useDashboardSummary } from '../api/dashboard.queries';

export function DashboardStats() {
  const organization = useActiveOrganization();
  const summary = useDashboardSummary(organization.id);

  if (summary.isError && !summary.data) {
    return (
      <div className="rounded-xl border bg-surface">
        <ErrorState
          error={summary.error}
          onRetry={() => void summary.refetch()}
          retrying={summary.isFetching}
          size="sm"
        />
      </div>
    );
  }

  const data = summary.data;
  const loading = summary.isPending;
  const completionRate =
    data && data.totalTasks > 0 ? (data.completedTasks / data.totalTasks) * 100 : 0;

  return (
    <section aria-label="Key metrics" className="space-y-2">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Total projects"
          value={data?.totalProjects}
          icon={<FolderKanban />}
          hint={data && `${data.activeProjects} active`}
          isLoading={loading}
        />
        <StatCard
          label="Total tasks"
          value={data?.totalTasks}
          icon={<ListTodo />}
          hint={data && `${data.dueThisWeek} due this week`}
          isLoading={loading}
        />
        <StatCard
          label="Completed tasks"
          value={data?.completedTasks}
          icon={<CircleCheck />}
          tone="success"
          hint={data && `${formatPercent(completionRate)} completion rate`}
          isLoading={loading}
        />
        <StatCard
          label="Overdue tasks"
          value={data?.overdueTasks}
          icon={<TriangleAlert />}
          tone={data && data.overdueTasks > 0 ? 'danger' : 'default'}
          hint={data && (data.overdueTasks > 0 ? 'Needs attention' : 'Nothing overdue')}
          isLoading={loading}
        />
        <StatCard
          label="Assigned to me"
          value={data?.assignedToMe}
          icon={<UserCheck />}
          hint="Open tasks"
          isLoading={loading}
          className="col-span-2 md:col-span-1"
        />
      </div>
      {summary.isError && (
        <StaleDataNotice
          error={summary.error}
          onRetry={() => void summary.refetch()}
          retrying={summary.isFetching}
        />
      )}
    </section>
  );
}
