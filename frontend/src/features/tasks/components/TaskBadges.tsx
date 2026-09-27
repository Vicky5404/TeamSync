import { CalendarDays } from 'lucide-react';

import { cn } from '@/lib/cn';
import type { Label, TaskPriority, TaskStatus } from '@/types';
import { formatDueDate, getDueState } from '@/utils/date';

import { LABEL_COLOR_CLASSES, TASK_PRIORITY_META, TASK_STATUS_META } from '../constants';

export function TaskStatusIcon({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = TASK_STATUS_META[status];
  const Icon = meta.icon;
  return <Icon aria-hidden="true" className={cn('size-4 shrink-0', meta.colorClass, className)} />;
}

export function TaskStatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap text-foreground',
        className,
      )}
    >
      <TaskStatusIcon status={status} className="size-3.5" />
      {TASK_STATUS_META[status].label}
    </span>
  );
}

interface TaskPriorityIndicatorProps {
  priority: TaskPriority;
  showLabel?: boolean;
  className?: string;
}

/** Priority icon (+ optional label). Icon-only usage is still announced. */
export function TaskPriorityIndicator({
  priority,
  showLabel = false,
  className,
}: TaskPriorityIndicatorProps) {
  const meta = TASK_PRIORITY_META[priority];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        meta.colorClass,
        className,
      )}
      title={showLabel ? undefined : `${meta.label} priority`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {showLabel ? (
        <span className="text-foreground">{meta.label}</span>
      ) : (
        <span className="sr-only">{meta.label} priority</span>
      )}
    </span>
  );
}

export function LabelChip({ label, className }: { label: Label; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-32 items-center truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium',
        LABEL_COLOR_CLASSES[label.color],
        className,
      )}
    >
      {label.name}
    </span>
  );
}

const DUE_TONES = {
  overdue: 'text-destructive',
  today: 'text-warning',
  soon: 'text-foreground',
  later: 'text-muted-foreground',
} as const;

interface DueDateLabelProps {
  dueDate: string;
  completed?: boolean;
  className?: string;
}

export function DueDateLabel({ dueDate, completed = false, className }: DueDateLabelProps) {
  const state = completed ? 'later' : getDueState(dueDate);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs whitespace-nowrap',
        DUE_TONES[state],
        className,
      )}
    >
      <CalendarDays aria-hidden="true" className="size-3.5" />
      <span>
        {state === 'overdue' && <span className="sr-only">Overdue, due </span>}
        {formatDueDate(dueDate)}
      </span>
    </span>
  );
}
