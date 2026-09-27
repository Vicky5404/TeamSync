import { CalendarDays, CircleCheck, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router';

import { AvatarGroup } from '@/components/ui/Avatar';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { paths } from '@/routes/paths';
import type { Project } from '@/types';
import { formatDate, isOverdue } from '@/utils/date';

import { ProjectStatusBadge } from './ProjectStatusBadge';

export function ProjectCard({ project }: { project: Project }) {
  const overdue = isOverdue(project.dueDate, project.status === 'COMPLETED');

  return (
    <article className="group relative flex flex-col rounded-xl border bg-surface p-5 shadow-xs transition-shadow focus-within:shadow-md hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{project.key}</p>
          <h2 className="truncate text-base font-semibold text-foreground">
            {/* Stretched link: the whole card is clickable, but only one tab stop. */}
            <Link
              to={paths.projectBoard(project.id)}
              className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-ring"
            >
              {project.name}
            </Link>
          </h2>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>

      <p className="mt-2 line-clamp-2 min-h-10 text-sm text-muted-foreground">
        {project.description ?? 'No description'}
      </p>

      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {project.taskCounts.completed}/{project.taskCounts.total} tasks
          </span>
          <span className="font-medium text-foreground tabular-nums">{project.progress}%</span>
        </div>
        <ProgressBar
          value={project.progress}
          label={`${project.name} progress`}
          tone={project.progress === 100 ? 'success' : 'primary'}
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
        <AvatarGroup users={project.members} max={4} size="sm" />
        <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
          {project.dueDate ? (
            <span
              className={
                overdue
                  ? 'inline-flex items-center gap-1 font-medium text-destructive'
                  : 'inline-flex items-center gap-1'
              }
            >
              {overdue ? (
                <TriangleAlert aria-hidden="true" className="size-3.5" />
              ) : (
                <CalendarDays aria-hidden="true" className="size-3.5" />
              )}
              {overdue ? 'Overdue · ' : 'Due '}
              {formatDate(project.dueDate)}
            </span>
          ) : project.status === 'COMPLETED' ? (
            <span className="inline-flex items-center gap-1">
              <CircleCheck aria-hidden="true" className="size-3.5" /> Completed
            </span>
          ) : (
            <span>No due date</span>
          )}
          <span>Created {formatDate(project.createdAt)}</span>
        </div>
      </div>
    </article>
  );
}
