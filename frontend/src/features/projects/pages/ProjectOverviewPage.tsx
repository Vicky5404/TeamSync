import { CalendarDays, CircleCheck, ListTodo, TriangleAlert, User } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { StatCard } from '@/components/common/StatCard';
import { Avatar } from '@/components/ui/Avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useProjectActivity } from '@/features/activity/api/activity.queries';
import { ActivityFeed } from '@/features/activity/components/ActivityFeed';
import { paths } from '@/routes/paths';
import { daysUntil, formatLongDate } from '@/utils/date';

import { useProjectContext } from '../project-context';

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}

export function ProjectOverviewPage() {
  const { project } = useProjectContext();
  const activity = useProjectActivity(project.id);
  const recent = activity.data?.pages.flatMap((page) => page.data).slice(0, 6);
  const open = project.taskCounts.total - project.taskCounts.completed;
  const daysLeft = project.dueDate ? daysUntil(project.dueDate) : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total tasks" value={project.taskCounts.total} icon={<ListTodo />} />
        <StatCard label="Open tasks" value={open} icon={<CircleCheck />} />
        <StatCard
          label="Completed"
          value={project.taskCounts.completed}
          icon={<CircleCheck />}
          tone="success"
          hint={`${project.progress}% of all tasks`}
        />
        <StatCard
          label="Overdue"
          value={project.taskCounts.overdue}
          icon={<TriangleAlert />}
          tone={project.taskCounts.overdue > 0 ? 'danger' : 'default'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
              <span className="text-sm font-semibold tabular-nums">{project.progress}%</span>
            </CardHeader>
            <CardContent className="space-y-3">
              <ProgressBar
                value={project.progress}
                size="md"
                label="Project progress"
                tone={project.progress === 100 ? 'success' : 'primary'}
              />
              <p className="text-sm text-muted-foreground">
                {project.taskCounts.completed} of {project.taskCounts.total} tasks completed
                {daysLeft !== null &&
                  (daysLeft >= 0
                    ? ` · ${daysLeft} day${daysLeft === 1 ? '' : 's'} until the due date`
                    : ` · ${Math.abs(daysLeft)} day${daysLeft === -1 ? '' : 's'} past the due date`)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <Link
                to={paths.projectActivity(project.id)}
                className="text-sm font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent>
              <ActivityFeed
                items={recent}
                isLoading={activity.isPending}
                error={activity.error}
                onRetry={() => void activity.refetch()}
                skeletonRows={4}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                <Detail label="Owner">
                  <span className="inline-flex items-center gap-2">
                    <Avatar
                      name={project.owner.name}
                      src={project.owner.avatarUrl}
                      size="xs"
                      decorative
                    />
                    {project.owner.name}
                  </span>
                </Detail>
                <Detail label="Start date">
                  {project.startDate ? formatLongDate(project.startDate) : '—'}
                </Detail>
                <Detail label="Due date">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays aria-hidden="true" className="size-3.5 text-muted-foreground" />
                    {project.dueDate ? formatLongDate(project.dueDate) : 'Not set'}
                  </span>
                </Detail>
                <Detail label="Created">{formatLongDate(project.createdAt)}</Detail>
                <Detail label="Last updated">{formatLongDate(project.updatedAt)}</Detail>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Members ({project.members.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {project.members.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User aria-hidden="true" className="size-4" /> No members yet
                </p>
              ) : (
                <ul className="space-y-3">
                  {project.members.map((member) => (
                    <li key={member.id} className="flex items-center gap-3">
                      <Avatar name={member.name} src={member.avatarUrl} size="sm" decorative />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{member.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
