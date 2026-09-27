import { useState } from 'react';

import { ChartCard } from '@/components/charts/ChartCard';
import { ChartDataTable } from '@/components/charts/ChartDataTable';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useActiveOrganization } from '@/features/organizations/active-organization';
import { COMPLETION_RANGES, type CompletionRange } from '@/types';
import { formatDate } from '@/utils/date';

import { useTaskCompletion } from '../api/dashboard.queries';

const SERIES = [
  { key: 'completed', label: 'Completed' },
  { key: 'created', label: 'Created' },
] as const;

const RANGE_OPTIONS = COMPLETION_RANGES.map((days) => ({ value: days, label: `${days}d` }));

export function TaskCompletionCard({ className }: { className?: string }) {
  const organization = useActiveOrganization();
  const [days, setDays] = useState<CompletionRange>(30);
  const completion = useTaskCompletion(organization.id, days);
  const data = completion.data ?? [];
  const formatX = (value: string) => formatDate(value, { month: 'short', day: 'numeric' });

  return (
    <ChartCard
      className={className}
      title="Task completion"
      description={`Tasks created and completed per day, last ${days} days`}
      actions={
        <SegmentedControl
          label="Date range"
          value={days}
          onValueChange={setDays}
          options={RANGE_OPTIONS}
        />
      }
      isLoading={completion.isPending}
      isRefreshing={completion.isPlaceholderData}
      error={completion.error}
      onRetry={() => void completion.refetch()}
      isEmpty={data.every((point) => point.created === 0 && point.completed === 0)}
      chart={() => (
        <TrendLineChart
          data={data}
          xKey="date"
          series={SERIES}
          formatX={formatX}
          ariaLabel={`Line chart of tasks created and completed per day over the last ${days} days`}
        />
      )}
      table={() => (
        <ChartDataTable
          data={data}
          caption={`Tasks created and completed per day, last ${days} days`}
          categoryLabel="Date"
          getCategory={(row) => formatDate(row.date)}
          series={SERIES}
          getValue={(row, key) => (key === 'created' ? row.created : row.completed)}
        />
      )}
    />
  );
}
