import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { KeyboardEvent } from 'react';

import type { Task } from '@/types';

import { TASK_STATUS_META } from '../../constants';
import { TaskCard } from './TaskCard';

interface SortableTaskCardProps {
  task: Task;
  onOpen: (taskId: string) => void;
  disabled?: boolean;
}

/**
 * Draggable card. Click or Enter opens the task; Space picks it up for
 * keyboard dragging (arrow keys move, Space drops, Escape cancels).
 */
export function SortableTaskCard({ task, onOpen, disabled = false }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', status: task.status },
    disabled,
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onOpen(task.id);
      return;
    }
    const dndKeyDown = listeners?.onKeyDown as
      ((keyboardEvent: KeyboardEvent<HTMLDivElement>) => void) | undefined;
    dndKeyDown?.(event);
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="list-none"
    >
      <TaskCard
        task={task}
        ghost={isDragging}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onClick={() => onOpen(task.id)}
        aria-roledescription={disabled ? undefined : 'Draggable task'}
        aria-label={`${task.identifier}: ${task.title}. ${TASK_STATUS_META[task.status].label}.`}
        className="cursor-pointer touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
    </li>
  );
}
