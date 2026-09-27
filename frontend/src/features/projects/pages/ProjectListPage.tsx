import { ListTodo, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { usePermissions } from '@/features/organizations/active-organization';
import { useProjectTasks } from '@/features/tasks/api/tasks.queries';
import { CreateTaskModal } from '@/features/tasks/components/CreateTaskModal';
import { TaskDrawer } from '@/features/tasks/components/details/TaskDrawer';
import { TaskFilterBar } from '@/features/tasks/components/filters/TaskFilterBar';
import { TaskTable } from '@/features/tasks/components/list/TaskTable';
import { TaskTableSkeleton } from '@/features/tasks/components/list/TaskTableSkeleton';
import { useTaskDrawer } from '@/features/tasks/hooks/useTaskDrawer';
import { useTaskFilters } from '@/features/tasks/hooks/useTaskFilters';
import { sortTasks, useTaskSort } from '@/features/tasks/hooks/useTaskSort';
import { pluralize } from '@/utils/format';

import { useProjectContext } from '../project-context';

export function ProjectListPage() {
  const { project } = useProjectContext();
  const { can } = usePermissions();
  const { apiFilters, activeCount, clear } = useTaskFilters();
  const { sort, toggle } = useTaskSort();
  const { taskId, openTask, closeTask } = useTaskDrawer();
  const [createOpen, setCreateOpen] = useState(false);
  const tasks = useProjectTasks(project.id, apiFilters);

  const sorted = useMemo(() => (tasks.data ? sortTasks(tasks.data, sort) : []), [tasks.data, sort]);
  const canCreate = can('tasks:create');

  return (
    <div className="space-y-4">
      <TaskFilterBar
        actions={
          canCreate && (
            <Button leftIcon={<Plus />} onClick={() => setCreateOpen(true)}>
              New task
            </Button>
          )
        }
      />

      {tasks.isPending ? (
        <TaskTableSkeleton />
      ) : tasks.isError ? (
        <ErrorState
          error={tasks.error}
          onRetry={() => void tasks.refetch()}
          retrying={tasks.isFetching}
        />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<ListTodo />}
          title={activeCount > 0 ? 'No tasks match your filters' : 'No tasks yet'}
          description={
            activeCount > 0
              ? 'Try adjusting or clearing the filters.'
              : 'Break the project down into tasks to get started.'
          }
          action={
            activeCount > 0 ? (
              <Button variant="outline" onClick={clear}>
                Clear filters
              </Button>
            ) : canCreate ? (
              <Button leftIcon={<Plus />} onClick={() => setCreateOpen(true)}>
                New task
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {pluralize(sorted.length, 'task')}
          </p>
          <TaskTable
            tasks={sorted}
            onOpenTask={openTask}
            sort={sort}
            onSort={toggle}
            isRefreshing={tasks.isPlaceholderData}
            caption={`${project.name} tasks`}
          />
        </>
      )}

      <TaskDrawer taskId={taskId} onClose={closeTask} />
      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={project.id}
        assignees={project.members}
        onCreated={openTask}
      />
    </div>
  );
}
