import { ChartCard } from '@/components/charts/ChartCard';
import { ChartDataTable } from '@/components/charts/ChartDataTable';
import { StackedBarChart } from '@/components/charts/StackedBarChart';
import { useActiveOrganization } from '@/features/organizations/active-organization';

import { useTeamWorkload } from '../api/dashboard.queries';

const SERIES = [
  { key: 'todo', label: 'To do' },
  { key: 'inProgress', label: 'In progress' },
  { key: 'review', label: 'In review' },
] as const;

const MAX_MEMBERS = 8;

export function TeamWorkloadCard({ className }: { className?: string }) {
  const organization = useActiveOrganization();
  const workload = useTeamWorkload(organization.id);

  const rows = (workload.data ?? [])
    .map((entry) => ({
      name: entry.member.name,
      todo: entry.todo,
      inProgress: entry.inProgress,
      review: entry.review,
      total: entry.todo + entry.inProgress + entry.review,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_MEMBERS);

  return (
    <ChartCard
      className={className}
      title="Team workload"
      description="Open tasks per person"
      isLoading={workload.isPending}
      error={workload.error}
      onRetry={() => void workload.refetch()}
      isEmpty={rows.length === 0}
      emptyMessage="No open tasks are assigned to anyone yet."
      chart={() => (
        <StackedBarChart
          data={rows}
          categoryKey="name"
          series={SERIES}
          ariaLabel="Stacked bar chart of open tasks per team member, split by status"
        />
      )}
      table={() => (
        <ChartDataTable
          data={rows}
          caption="Open tasks per team member by status"
          categoryLabel="Member"
          getCategory={(row) => row.name}
          series={SERIES}
          getValue={(row, key) => row[key as 'todo' | 'inProgress' | 'review']}
        />
      )}
    />
  );
}
