import { FolderKanban } from 'lucide-react';
import { Link } from 'react-router';

import { StaleDataNotice } from '@/components/common/StaleDataNotice';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton';
import { useActiveOrganization } from '@/features/organizations/active-organization';
import { ProjectStatusBadge } from '@/features/projects/components/ProjectStatusBadge';
import { paths } from '@/routes/paths';
import { formatDueDate, isOverdue } from '@/utils/date';

import { useProjectProgress } from '../api/dashboard.queries';

export function ProjectProgressCard({ className }: { className?: string }) {
  const organization = useActiveOrganization();
  const progress = useProjectProgress(organization.id);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Project progress</CardTitle>
        <Link to={paths.projects} className="text-sm font-medium text-primary hover:underline">
          All projects
        </Link>
      </CardHeader>
      <CardContent>
        {progress.isPending ? (
          <SkeletonGroup label="Loading project progress" className="space-y-5">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </SkeletonGroup>
        ) : !progress.data ? (
          <ErrorState error={progress.error} onRetry={() => void progress.refetch()} size="sm" />
        ) : progress.data.length === 0 ? (
          <EmptyState
            icon={<FolderKanban />}
            title="No active projects"
            description="Projects you create will show their progress here."
            size="sm"
          />
        ) : (
          <>
            <ul className="space-y-4">
              {progress.data.slice(0, 6).map((project) => {
                const overdue = isOverdue(project.dueDate, project.status === 'COMPLETED');
                return (
                  <li key={project.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <Link
                        to={paths.projectBoard(project.id)}
                        className="min-w-0 truncate text-sm font-medium hover:underline"
                      >
                        {project.name}
                      </Link>
                      <div className="flex shrink-0 items-center gap-2">
                        <ProjectStatusBadge status={project.status} />
                        <span className="w-9 text-right text-sm font-semibold tabular-nums">
                          {project.progress}%
                        </span>
                      </div>
                    </div>
                    <ProgressBar
                      value={project.progress}
                      label={`${project.name} progress`}
                      tone={project.progress === 100 ? 'success' : overdue ? 'danger' : 'primary'}
                    />
                    <p className="text-xs text-muted-foreground">
                      {project.completedTasks}/{project.totalTasks} tasks
                      {project.dueDate && (
                        <span className={overdue ? 'font-medium text-destructive' : undefined}>
                          {' · '}
                          {overdue ? 'Overdue since ' : 'Due '}
                          {formatDueDate(project.dueDate)}
                        </span>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
            {progress.isError && (
              <StaleDataNotice
                error={progress.error}
                onRetry={() => void progress.refetch()}
                retrying={progress.isFetching}
                className="mt-3"
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
