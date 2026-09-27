import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { cn } from '@/lib/cn';
import type { Task, TaskStatus } from '@/types';

import { TASK_STATUS_META } from '../../constants';
import { TaskStatusIcon } from '../TaskBadges';
import { QuickAddTask } from './QuickAddTask';
import { SortableTaskCard } from './SortableTaskCard';

interface KanbanColumnProps {
  projectId: string;
  status: TaskStatus;
  tasks: Task[];
  onOpenTask: (taskId: string) => void;
  canEdit: boolean;
  canCreate: boolean;
}

export function KanbanColumn({
  projectId,
  status,
  tasks,
  onOpenTask,
  canEdit,
  canCreate,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: 'column' } });
  const meta = TASK_STATUS_META[status];
  const headingId = `column-${status}`;

  return (
    <section
      aria-labelledby={headingId}
      className="flex w-[18rem] shrink-0 snap-start flex-col rounded-xl bg-surface-muted/70 sm:w-72"
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <TaskStatusIcon status={status} />
        <h2 id={headingId} className="text-sm font-semibold text-foreground">
          {meta.label}
        </h2>
        <span className="rounded-full bg-surface px-1.5 text-xs font-medium text-muted-foreground tabular-nums">
          {tasks.length}
        </span>
      </header>

      <SortableContext
        id={status}
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul
          ref={setNodeRef}
          aria-label={`${meta.label} tasks`}
          className={cn(
            'flex min-h-24 flex-1 flex-col gap-2 rounded-lg px-2 pb-2 transition-colors',
            isOver && 'bg-primary-soft/40',
          )}
        >
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} onOpen={onOpenTask} disabled={!canEdit} />
          ))}
          {tasks.length === 0 && (
            <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-input px-3 py-6 text-center text-xs text-muted-foreground">
              {canEdit ? 'Drop tasks here' : 'No tasks'}
            </li>
          )}
        </ul>
      </SortableContext>

      {canCreate && (
        <div className="px-2 pb-2">
          <QuickAddTask projectId={projectId} status={status} />
        </div>
      )}
    </section>
  );
}
