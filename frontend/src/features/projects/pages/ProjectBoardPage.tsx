import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton';
import { usePermissions } from '@/features/organizations/active-organization';
import { useProjectTasks } from '@/features/tasks/api/tasks.queries';
import { KanbanBoard } from '@/features/tasks/components/board/KanbanBoard';
import { CreateTaskModal } from '@/features/tasks/components/CreateTaskModal';
import { TaskDrawer } from '@/features/tasks/components/details/TaskDrawer';
import { TaskFilterBar } from '@/features/tasks/components/filters/TaskFilterBar';
import { useTaskDrawer } from '@/features/tasks/hooks/useTaskDrawer';
import { useTaskFilters } from '@/features/tasks/hooks/useTaskFilters';
import { TASK_STATUSES } from '@/types';

import { useProjectContext } from '../project-context';

export function ProjectBoardPage() {
  const { project } = useProjectContext();
  const { can } = usePermissions();
  const { apiFilters, state, activeCount, clear } = useTaskFilters();
  const { taskId, openTask, closeTask } = useTaskDrawer();
  const [createOpen, setCreateOpen] = useState(false);

  // Status filtering on the board hides columns instead of filtering server-side.
  const { status: _status, ...boardFilters } = apiFilters;
  const tasks = useProjectTasks(project.id, boardFilters);
  const statuses = state.status.length
    ? TASK_STATUSES.filter((s) => state.status.includes(s))
    : TASK_STATUSES;
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
        <BoardSkeleton />
      ) : tasks.isError ? (
        <ErrorState
          error={tasks.error}
          onRetry={() => void tasks.refetch()}
          retrying={tasks.isFetching}
        />
      ) : (
        <>
          {activeCount > 0 && tasks.data.length === 0 && (
            <Alert
              variant="info"
              action={
                <Button variant="link" size="sm" onClick={clear}>
                  Clear filters
                </Button>
              }
            >
              No tasks match the current filters.
            </Alert>
          )}
          <KanbanBoard
            projectId={project.id}
            tasks={tasks.data}
            statuses={statuses}
            onOpenTask={openTask}
            canEdit={can('tasks:update')}
            canCreate={canCreate}
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

function BoardSkeleton() {
  return (
    <SkeletonGroup label="Loading board" className="flex gap-3 overflow-hidden">
      {TASK_STATUSES.map((status, column) => (
        <div key={status} className="w-72 shrink-0 space-y-2 rounded-xl bg-surface-muted/70 p-3">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 3 - (column % 2) }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full bg-surface" />
          ))}
        </div>
      ))}
    </SkeletonGroup>
  );
}
