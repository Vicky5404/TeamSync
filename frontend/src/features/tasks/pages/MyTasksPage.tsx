import { ListTodo } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useActiveOrganization } from '@/features/organizations/active-organization';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { readEnum, readPositiveInt, withParams } from '@/utils/search-params';

import { useOrganizationTasks } from '../api/tasks.queries';
import { TaskDrawer } from '../components/details/TaskDrawer';
import { TaskFilterBar } from '../components/filters/TaskFilterBar';
import { TaskTable } from '../components/list/TaskTable';
import { TaskTableSkeleton } from '../components/list/TaskTableSkeleton';
import { useTaskDrawer } from '../hooks/useTaskDrawer';
import { useTaskFilters } from '../hooks/useTaskFilters';
import { useTaskSort } from '../hooks/useTaskSort';

const PAGE_SIZE = 25;
const SCOPES = ['mine', 'all'] as const;
type Scope = (typeof SCOPES)[number];

export function MyTasksPage() {
  useDocumentTitle('My tasks');
  const organization = useActiveOrganization();
  const [searchParams, setSearchParams] = useSearchParams();
  const scope: Scope = readEnum(searchParams, 'scope', SCOPES) ?? 'mine';
  const page = readPositiveInt(searchParams, 'page', 1);

  const { apiFilters, activeCount, clear } = useTaskFilters();
  const { sort, toggle } = useTaskSort({ field: 'dueDate', order: 'asc' });
  const { taskId, openTask, closeTask } = useTaskDrawer();

  const tasks = useOrganizationTasks(organization.id, {
    ...apiFilters,
    assignee: scope === 'mine' ? ['me'] : apiFilters.assignee,
    sort: sort.field,
    order: sort.order,
    page,
    pageSize: PAGE_SIZE,
  });

  const setScope = (next: Scope) =>
    setSearchParams(
      (current) =>
        withParams(current, { scope: next === 'mine' ? null : next, page: null, assignee: null }),
      { replace: true },
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="My tasks"
        description={`Everything on your plate across ${organization.name}.`}
        actions={
          <SegmentedControl
            label="Task scope"
            size="md"
            value={scope}
            onValueChange={setScope}
            options={[
              { value: 'mine', label: 'Assigned to me' },
              { value: 'all', label: 'All tasks' },
            ]}
          />
        }
      />

      <TaskFilterBar hide={scope === 'mine' ? ['assignee'] : []} />

      {tasks.isPending ? (
        <TaskTableSkeleton />
      ) : tasks.isError ? (
        <ErrorState
          error={tasks.error}
          onRetry={() => void tasks.refetch()}
          retrying={tasks.isFetching}
        />
      ) : tasks.data.data.length === 0 ? (
        <EmptyState
          icon={<ListTodo />}
          title={activeCount > 0 ? 'No tasks match your filters' : "You're all caught up"}
          description={
            activeCount > 0
              ? 'Try removing some filters to see more tasks.'
              : scope === 'mine'
                ? 'No tasks are assigned to you right now.'
                : 'There are no tasks in this organization yet.'
          }
          action={
            activeCount > 0 ? (
              <Button variant="outline" onClick={clear}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <TaskTable
            tasks={tasks.data.data}
            onOpenTask={openTask}
            sort={sort}
            onSort={toggle}
            showProject
            isRefreshing={tasks.isPlaceholderData}
            caption="Tasks"
          />
          <Pagination
            meta={tasks.data.meta}
            onPageChange={(next) =>
              setSearchParams((current) => withParams(current, { page: next > 1 ? next : null }))
            }
          />
        </div>
      )}

      <TaskDrawer taskId={taskId} onClose={closeTask} />
    </div>
  );
}
