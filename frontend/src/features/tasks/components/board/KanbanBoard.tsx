import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useMemo, useState } from 'react';

import { getErrorMessage } from '@/lib/http';
import { toast } from '@/store/toast.store';
import { TASK_STATUSES, type Task, type TaskStatus } from '@/types';

import { useMoveTask } from '../../api/tasks.queries';
import { TASK_STATUS_META } from '../../constants';
import {
  boardKeyboardCoordinates,
  groupTasksByStatus,
  isStatus,
  positionBetween,
  toColumnIds,
  type BoardColumns,
} from './board-utils';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';

interface KanbanBoardProps {
  projectId: string;
  tasks: Task[];
  /** Columns to show (all statuses when the status filter is empty). */
  statuses?: readonly TaskStatus[];
  onOpenTask: (taskId: string) => void;
  canEdit: boolean;
  canCreate: boolean;
}

interface DropState {
  columns: BoardColumns;
  /** The task list the drop was based on; cleared once fresh data arrives. */
  basedOn: Task[];
}

const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    'To pick up a task, press Space. While dragging, use the arrow keys to move it between positions and columns. Press Space again to drop, or Escape to cancel. Press Enter to open the task.',
};

export function KanbanBoard({
  projectId,
  tasks,
  statuses = TASK_STATUSES,
  onOpenTask,
  canEdit,
  canCreate,
}: KanbanBoardProps) {
  const moveTask = useMoveTask(projectId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragColumns, setDragColumns] = useState<BoardColumns | null>(null);
  const [dropState, setDropState] = useState<DropState | null>(null);

  // Keep the dropped layout until the optimistic cache update lands (no flicker).
  if (dropState && dropState.basedOn !== tasks) setDropState(null);

  const grouped = useMemo(() => groupTasksByStatus(tasks), [tasks]);
  const baseColumns = useMemo(() => toColumnIds(grouped), [grouped]);
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const columns = dragColumns ?? dropState?.columns ?? baseColumns;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: boardKeyboardCoordinates(statuses),
      // Enter is reserved for opening the task.
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  const findContainer = (id: UniqueIdentifier, source: BoardColumns): TaskStatus | undefined => {
    if (isStatus(id)) return id;
    return TASK_STATUSES.find((status) => source[status].includes(String(id)));
  };

  const taskTitle = (id: UniqueIdentifier) => tasksById.get(String(id))?.title ?? 'task';
  const columnLabel = (id: UniqueIdentifier | undefined) => {
    if (id === undefined) return 'the board';
    const status = findContainer(id, columns);
    return status ? TASK_STATUS_META[status].label : 'the board';
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${taskTitle(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${taskTitle(active.id)} is over ${columnLabel(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${taskTitle(active.id)} was dropped in ${columnLabel(over.id)}.`
        : `${taskTitle(active.id)} was dropped.`,
    onDragCancel: ({ active }) => `Moving ${taskTitle(active.id)} was cancelled.`,
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setDragColumns(baseColumns);
    setDropState(null);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    setDragColumns((previous) => {
      const current = previous ?? baseColumns;
      const from = findContainer(active.id, current);
      const to = findContainer(over.id, current);
      if (!from || !to || from === to) return current;

      const activeKey = String(active.id);
      const target = current[to].filter((id) => id !== activeKey);
      const overIndex = target.indexOf(String(over.id));
      const translated = active.rect.current.translated;
      const below = translated ? translated.top > over.rect.top + over.rect.height / 2 : false;
      const insertAt = overIndex >= 0 ? overIndex + (below ? 1 : 0) : target.length;
      target.splice(insertAt, 0, activeKey);

      return {
        ...current,
        [from]: current[from].filter((id) => id !== activeKey),
        [to]: target,
      };
    });
  };

  const resetDrag = () => {
    setActiveId(null);
    setDragColumns(null);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const current = dragColumns ?? baseColumns;
    const task = tasksById.get(String(active.id));
    const container = findContainer(active.id, current);
    const overContainer = over ? findContainer(over.id, current) : undefined;
    resetDrag();
    if (!task || !container || !over || overContainer !== container) return;

    let ids = current[container];
    const oldIndex = ids.indexOf(task.id);
    const newIndex = ids.indexOf(String(over.id));
    if (newIndex >= 0 && oldIndex !== newIndex) ids = arrayMove(ids, oldIndex, newIndex);

    const index = ids.indexOf(task.id);
    const unchanged =
      container === task.status && baseColumns[container].indexOf(task.id) === index;
    if (unchanged) return;

    const before = tasksById.get(ids[index - 1] ?? '')?.position;
    const after = tasksById.get(ids[index + 1] ?? '')?.position;
    const position = positionBetween(before, after);

    setDropState({ columns: { ...current, [container]: ids }, basedOn: tasks });
    // mutateAsync so the error toast fires for every move, not only the latest one.
    void moveTask
      .mutateAsync({ taskId: task.id, status: container, position })
      .catch((error: unknown) =>
        toast.error(`Couldn't move ${task.identifier}`, {
          description: `${getErrorMessage(error)} The change was reverted.`,
        }),
      );
  };

  const activeTask = activeId ? tasksById.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={resetDrag}
      accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
    >
      <div className="relative -mx-4 flex snap-x snap-mandatory scrollbar-thin gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:snap-none">
        {statuses.map((status) => (
          <KanbanColumn
            key={status}
            projectId={projectId}
            status={status}
            tasks={columns[status]
              .map((id) => tasksById.get(id))
              .filter((task): task is Task => task !== undefined)}
            onOpenTask={onOpenTask}
            canEdit={canEdit}
            canCreate={canCreate}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? <TaskCard task={activeTask} dragging className="w-72" /> : null}
      </DragOverlay>
    </DndContext>
  );
}
