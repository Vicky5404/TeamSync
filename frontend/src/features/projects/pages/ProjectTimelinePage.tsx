import { CalendarClock, ChartGantt } from 'lucide-react';
import { useMemo } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton';
import { useProjectTasks } from '@/features/tasks/api/tasks.queries';
import { DueDateLabel, TaskStatusIcon } from '@/features/tasks/components/TaskBadges';
import { useTaskDrawer } from '@/features/tasks/hooks/useTaskDrawer';
import { TaskDrawer } from '@/features/tasks/components/details/TaskDrawer';

import { useProjectContext } from '../project-context';

const UPCOMING_FILTERS = { status: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW'] } as const;

/**
 * Placeholder for the upcoming Gantt timeline. Until it ships, the page lists
 * open tasks by due date so the view is still useful.
 */
export function ProjectTimelinePage() {
  const { project } = useProjectContext();
  const { taskId, openTask, closeTask } = useTaskDrawer();
  const tasks = useProjectTasks(project.id, { status: [...UPCOMING_FILTERS.status] });

  const upcoming = useMemo(
    () =>
      (tasks.data ?? [])
        .filter((task) => task.dueDate !== null)
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
        .slice(0, 12),
    [tasks.data],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <EmptyState
          icon={<ChartGantt />}
          title="Timeline view is coming soon"
          description="Plan start and due dates on an interactive Gantt chart, see dependencies and drag to reschedule. We're putting the finishing touches on it."
        />
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Upcoming due dates</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.isPending ? (
            <SkeletonGroup label="Loading upcoming tasks" className="space-y-3">
              {[0, 1, 2, 3].map((row) => (
                <Skeleton key={row} className="h-9 w-full" />
              ))}
            </SkeletonGroup>
          ) : tasks.isError ? (
            <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} size="sm" />
          ) : upcoming.length === 0 ? (
            <EmptyState
              icon={<CalendarClock />}
              title="Nothing scheduled"
              description="Open tasks with due dates will appear here."
              size="sm"
            />
          ) : (
            <ol className="divide-y">
              {upcoming.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => openTask(task.id)}
                    className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-accent/50"
                  >
                    <TaskStatusIcon status={task.status} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <span className="text-muted-foreground">{task.identifier}</span>{' '}
                      <span className="font-medium">{task.title}</span>
                    </span>
                    {task.dueDate && <DueDateLabel dueDate={task.dueDate} />}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <TaskDrawer taskId={taskId} onClose={closeTask} />
    </div>
  );
}
