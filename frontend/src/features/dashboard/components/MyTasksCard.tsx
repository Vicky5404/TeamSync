import { CircleCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { StaleDataNotice } from '@/components/common/StaleDataNotice';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton';
import { useActiveOrganization } from '@/features/organizations/active-organization';
import { useOrganizationTasks } from '@/features/tasks/api/tasks.queries';
import {
  DueDateLabel,
  TaskPriorityIndicator,
  TaskStatusIcon,
} from '@/features/tasks/components/TaskBadges';
import { paths } from '@/routes/paths';

const OPEN_STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW'] as const;

export function MyTasksCard({ className }: { className?: string }) {
  const organization = useActiveOrganization();
  const navigate = useNavigate();
  const tasks = useOrganizationTasks(organization.id, {
    assignee: ['me'],
    status: [...OPEN_STATUSES],
    sort: 'dueDate',
    order: 'asc',
    pageSize: 6,
  });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Assigned to me</CardTitle>
        <Link to={paths.myTasks} className="text-sm font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {tasks.isPending ? (
          <SkeletonGroup label="Loading your tasks" className="space-y-3">
            {[0, 1, 2, 3, 4].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </SkeletonGroup>
        ) : !tasks.data ? (
          <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} size="sm" />
        ) : tasks.data.data.length === 0 ? (
          <EmptyState
            icon={<CircleCheck />}
            title="You're all caught up"
            description="No open tasks are assigned to you."
            size="sm"
          />
        ) : (
          <>
            <ul className="-mx-2 divide-y">
              {tasks.data.data.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => void navigate(paths.task(task.project.id, task.id))}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-accent/60"
                  >
                    <TaskStatusIcon status={task.status} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{task.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {task.identifier} · {task.project.name}
                      </span>
                    </span>
                    <TaskPriorityIndicator priority={task.priority} />
                    {task.dueDate && <DueDateLabel dueDate={task.dueDate} />}
                  </button>
                </li>
              ))}
            </ul>
            {tasks.isError && (
              <StaleDataNotice
                error={tasks.error}
                onRetry={() => void tasks.refetch()}
                retrying={tasks.isFetching}
                className="mt-3"
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
