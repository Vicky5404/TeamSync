import { Avatar } from '@/components/ui/Avatar';
import {
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { cn } from '@/lib/cn';
import type { Task, TaskSortField } from '@/types';

import type { TaskSort } from '../../hooks/useTaskSort';
import {
  DueDateLabel,
  LabelChip,
  TaskPriorityIndicator,
  TaskStatusBadge,
  TaskStatusIcon,
} from '../TaskBadges';

interface TaskTableProps {
  tasks: readonly Task[];
  onOpenTask: (taskId: string) => void;
  sort: TaskSort;
  onSort: (field: TaskSortField) => void;
  showProject?: boolean;
  /** Dim while refetching with previous data. */
  isRefreshing?: boolean;
  caption: string;
}

/** Task list: sortable table on larger screens, compact cards on mobile. */
export function TaskTable({
  tasks,
  onOpenTask,
  sort,
  onSort,
  showProject = false,
  isRefreshing = false,
  caption,
}: TaskTableProps) {
  const sortable = (field: TaskSortField, label: string, className?: string) => (
    <SortableTableHead
      active={sort.field === field}
      order={sort.order}
      onSort={() => onSort(field)}
      className={className}
    >
      {label}
    </SortableTableHead>
  );

  return (
    <div
      className={cn('transition-opacity', isRefreshing && 'opacity-60')}
      aria-busy={isRefreshing || undefined}
    >
      {/* Desktop / tablet */}
      <Table containerClassName="hidden md:block">
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {sortable('title', 'Task', 'w-[40%]')}
            {showProject && <TableHead>Project</TableHead>}
            {sortable('status', 'Status')}
            {sortable('priority', 'Priority')}
            <TableHead>Assignee</TableHead>
            {sortable('dueDate', 'Due')}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id} className="cursor-pointer" onClick={() => onOpenTask(task.id)}>
              <TableCell>
                <div className="flex min-w-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenTask(task.id);
                    }}
                    className="flex min-w-0 items-baseline gap-2 text-left hover:underline"
                  >
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {task.identifier}
                    </span>
                    <span className="truncate font-medium text-foreground">{task.title}</span>
                  </button>
                  {task.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {task.labels.map((label) => (
                        <LabelChip key={label.id} label={label} />
                      ))}
                    </div>
                  )}
                </div>
              </TableCell>
              {showProject && (
                <TableCell className="max-w-40 truncate text-muted-foreground">
                  {task.project.name}
                </TableCell>
              )}
              <TableCell>
                <TaskStatusBadge status={task.status} />
              </TableCell>
              <TableCell>
                <TaskPriorityIndicator priority={task.priority} showLabel />
              </TableCell>
              <TableCell>
                {task.assignee ? (
                  <span className="flex items-center gap-2">
                    <Avatar
                      name={task.assignee.name}
                      src={task.assignee.avatarUrl}
                      size="xs"
                      decorative
                    />
                    <span className="truncate">{task.assignee.name}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </TableCell>
              <TableCell>
                {task.dueDate ? (
                  <DueDateLabel dueDate={task.dueDate} completed={task.status === 'DONE'} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Mobile */}
      <ul className="divide-y rounded-xl border bg-surface md:hidden" aria-label={caption}>
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => onOpenTask(task.id)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent/60"
            >
              <TaskStatusIcon status={task.status} className="mt-0.5" />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {task.title}
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{task.identifier}</span>
                  {showProject && <span className="truncate">{task.project.name}</span>}
                  <TaskPriorityIndicator priority={task.priority} />
                  {task.dueDate && (
                    <DueDateLabel dueDate={task.dueDate} completed={task.status === 'DONE'} />
                  )}
                </span>
              </span>
              {task.assignee && (
                <Avatar name={task.assignee.name} src={task.assignee.avatarUrl} size="sm" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
