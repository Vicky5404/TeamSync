import type { KeyboardCoordinateGetter } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import { TASK_STATUSES, type Task, type TaskStatus } from '@/types';

import { POSITION_STEP } from '../../constants';

export type BoardColumns = Record<TaskStatus, string[]>;

export function groupTasksByStatus(tasks: readonly Task[]): Record<TaskStatus, Task[]> {
  const groups = Object.fromEntries(
    TASK_STATUSES.map((status) => [status, [] as Task[]]),
  ) as Record<TaskStatus, Task[]>;
  for (const task of tasks) groups[task.status].push(task);
  for (const status of TASK_STATUSES) groups[status].sort((a, b) => a.position - b.position);
  return groups;
}

export function toColumnIds(groups: Record<TaskStatus, Task[]>): BoardColumns {
  return Object.fromEntries(
    TASK_STATUSES.map((status) => [status, groups[status].map((task) => task.id)]),
  ) as BoardColumns;
}

export function isStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

/** Column of a droppable: the column itself, or the sortable list a card belongs to. */
function columnOf(item: {
  id: string | number;
  data: { current?: { sortable?: { containerId?: unknown } } };
}): TaskStatus | undefined {
  if (isStatus(item.id)) return item.id;
  const containerId = item.data.current?.sortable?.containerId;
  return isStatus(containerId) ? containerId : undefined;
}

/**
 * Keyboard dragging: Up/Down reorder within a column (dnd-kit's sortable
 * behaviour) while Left/Right jump straight to the adjacent visible column.
 * The default getter aims at the closest droppable to the side, which can be
 * the dragged card itself (its drag overlay is slightly larger than the card),
 * so cross-column moves silently did nothing for some card sizes.
 */
export function boardKeyboardCoordinates(
  statuses: readonly TaskStatus[],
): KeyboardCoordinateGetter {
  return (event, args) => {
    const step = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return sortableKeyboardCoordinates(event, args);

    event.preventDefault();
    const { active, over, collisionRect, droppableRects } = args.context;
    if (!active || !collisionRect) return undefined;
    const current = (over && columnOf(over)) ?? columnOf(active);
    const target = current ? statuses[statuses.indexOf(current) + step] : undefined;
    const rect = target ? droppableRects.get(target) : undefined;
    if (!rect) return undefined;
    return { x: rect.left + (rect.width - collisionRect.width) / 2, y: rect.top };
  };
}

/**
 * Fractional ordering: a new position strictly between its neighbours, so a
 * move only ever updates the moved task (the API may rebalance occasionally).
 */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return POSITION_STEP;
  if (before === undefined) return (after ?? 0) - POSITION_STEP;
  if (after === undefined) return before + POSITION_STEP;
  return (before + after) / 2;
}
