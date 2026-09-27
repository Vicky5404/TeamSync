import { ListChecks, MessageSquare, Paperclip } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import type { Task } from '@/types';

import { DueDateLabel, LabelChip, TaskPriorityIndicator } from '../TaskBadges';

interface TaskCardProps extends ComponentProps<'div'> {
  task: Task;
  /** Visual state while the card is being dragged (rendered in the overlay). */
  dragging?: boolean;
  /** Placeholder left in the column while dragging. */
  ghost?: boolean;
}

/** Presentational Kanban card. Interaction is attached by `SortableTaskCard`. */
export function TaskCard({ task, dragging, ghost, className, ...props }: TaskCardProps) {
  const completed = task.status === 'DONE';
  const hasMeta =
    task.dueDate ||
    task.commentCount > 0 ||
    task.attachmentCount > 0 ||
    task.checklist.total > 0 ||
    task.assignee;

  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-surface p-3 text-left shadow-xs transition-shadow',
        'hover:border-input hover:shadow-sm',
        dragging && 'rotate-1 cursor-grabbing border-input shadow-lg',
        ghost && 'opacity-40',
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{task.identifier}</span>
        <TaskPriorityIndicator priority={task.priority} />
      </div>

      <p
        className={cn(
          'mt-1 line-clamp-2 text-sm font-medium text-foreground',
          completed && 'text-muted-foreground line-through decoration-muted-foreground/50',
        )}
      >
        {task.title}
      </p>

      {task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
          {task.labels.length > 3 && (
            <span className="text-[11px] text-muted-foreground">+{task.labels.length - 3}</span>
          )}
        </div>
      )}

      {hasMeta && (
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          {task.dueDate && <DueDateLabel dueDate={task.dueDate} completed={completed} />}
          {task.checklist.total > 0 && (
            <span className="inline-flex items-center gap-1" title="Checklist">
              <ListChecks aria-hidden="true" className="size-3.5" />
              <span className="sr-only">Checklist</span>
              {task.checklist.completed}/{task.checklist.total}
            </span>
          )}
          {task.commentCount > 0 && (
            <span className="inline-flex items-center gap-1" title="Comments">
              <MessageSquare aria-hidden="true" className="size-3.5" />
              <span className="sr-only">Comments:</span>
              {task.commentCount}
            </span>
          )}
          {task.attachmentCount > 0 && (
            <span className="inline-flex items-center gap-1" title="Attachments">
              <Paperclip aria-hidden="true" className="size-3.5" />
              <span className="sr-only">Attachments:</span>
              {task.attachmentCount}
            </span>
          )}
          {task.assignee && (
            <Avatar
              name={task.assignee.name}
              src={task.assignee.avatarUrl}
              size="xs"
              className="ml-auto"
            />
          )}
        </div>
      )}
    </div>
  );
}
