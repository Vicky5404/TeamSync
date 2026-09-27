import { CircleCheck, ListTodo, Timer, TriangleAlert } from 'lucide-react';

import { ChartCard } from '@/components/charts/ChartCard';
import { ChartDataTable } from '@/components/charts/ChartDataTable';
import { ColumnChart } from '@/components/charts/ColumnChart';
import { StackedBarChart } from '@/components/charts/StackedBarChart';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { StatCard } from '@/components/common/StatCard';
import { TASK_PRIORITY_META, TASK_STATUS_META } from '@/features/tasks/constants';
import { formatDate } from '@/utils/date';

import { useProjectAnalytics } from '../api/projects.queries';
import { useProjectContext } from '../project-context';

const TREND_SERIES = [
  { key: 'completed', label: 'Completed' },
  { key: 'created', label: 'Created' },
] as const;

const WORKLOAD_SERIES = [
  { key: 'todo', label: 'To do' },
  { key: 'inProgress', label: 'In progress' },
  { key: 'review', label: 'In review' },
] as const;

export function ProjectAnalyticsPage() {
  const { project } = useProjectContext();
  const analytics = useProjectAnalytics(project.id);
  const data = analytics.data;
  const retry = () => void analytics.refetch();

  const byStatus = (data?.byStatus ?? []).map((item) => ({
    label: TASK_STATUS_META[item.status].label,
    value: item.count,
  }));
  const byPriority = (data?.byPriority ?? []).map((item) => ({
    label: TASK_PRIORITY_META[item.priority].label,
    value: item.count,
  }));
  const workload = (data?.workload ?? []).map((entry) => ({
    name: entry.member.name,
    todo: entry.todo,
    inProgress: entry.inProgress,
    review: entry.review,
  }));
  const common = { isLoading: analytics.isPending, error: analytics.error, onRetry: retry };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total tasks"
          value={data?.summary.total}
          icon={<ListTodo />}
          isLoading={analytics.isPending}
        />
        <StatCard
          label="Completed"
          value={data?.summary.completed}
          icon={<CircleCheck />}
          tone="success"
          isLoading={analytics.isPending}
        />
        <StatCard
          label="Overdue"
          value={data?.summary.overdue}
          icon={<TriangleAlert />}
          tone={data && data.summary.overdue > 0 ? 'danger' : 'default'}
          isLoading={analytics.isPending}
        />
        <StatCard
          label="Avg. cycle time (days)"
          value={data?.summary.averageCycleTimeDays ?? undefined}
          icon={<Timer />}
          hint={
            data && data.summary.averageCycleTimeDays === null
              ? 'Not enough completed tasks'
              : 'From creation to done'
          }
          isLoading={analytics.isPending}
        />
      </div>

      <ChartCard
        title="Created vs. completed"
        description="Tasks per day over the last 30 days"
        {...common}
        isEmpty={!data?.completionTrend.length}
        chart={() => (
          <TrendLineChart
            data={data?.completionTrend ?? []}
            xKey="date"
            series={TREND_SERIES}
            formatX={(value) => formatDate(value, { month: 'short', day: 'numeric' })}
            ariaLabel="Line chart of tasks created and completed per day over the last 30 days"
          />
        )}
        table={() => (
          <ChartDataTable
            data={data?.completionTrend ?? []}
            caption="Tasks created and completed per day"
            categoryLabel="Date"
            getCategory={(row) => formatDate(row.date)}
            series={TREND_SERIES}
            getValue={(row, key) => (key === 'created' ? row.created : row.completed)}
          />
        )}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Tasks by status"
          {...common}
          isEmpty={byStatus.every((item) => item.value === 0)}
          chart={() => (
            <ColumnChart
              data={byStatus}
              valueLabel="Tasks"
              ariaLabel="Column chart of tasks by status"
            />
          )}
          table={() => (
            <ChartDataTable
              data={byStatus}
              caption="Tasks by status"
              categoryLabel="Status"
              getCategory={(row) => row.label}
              series={[{ key: 'value', label: 'Tasks' }]}
              getValue={(row) => row.value}
            />
          )}
        />
        <ChartCard
          title="Tasks by priority"
          {...common}
          isEmpty={byPriority.every((item) => item.value === 0)}
          chart={() => (
            <ColumnChart
              data={byPriority}
              valueLabel="Tasks"
              ariaLabel="Column chart of tasks by priority"
            />
          )}
          table={() => (
            <ChartDataTable
              data={byPriority}
              caption="Tasks by priority"
              categoryLabel="Priority"
              getCategory={(row) => row.label}
              series={[{ key: 'value', label: 'Tasks' }]}
              getValue={(row) => row.value}
            />
          )}
        />
      </div>

      <ChartCard
        title="Workload by member"
        description="Open tasks assigned to each project member"
        {...common}
        isEmpty={workload.length === 0}
        emptyMessage="No open tasks are assigned yet."
        chart={() => (
          <StackedBarChart
            data={workload}
            categoryKey="name"
            series={WORKLOAD_SERIES}
            ariaLabel="Stacked bar chart of open tasks per member by status"
          />
        )}
        table={() => (
          <ChartDataTable
            data={workload}
            caption="Open tasks per member by status"
            categoryLabel="Member"
            getCategory={(row) => row.name}
            series={WORKLOAD_SERIES}
            getValue={(row, key) => row[key as 'todo' | 'inProgress' | 'review']}
          />
        )}
      />
    </div>
  );
}
