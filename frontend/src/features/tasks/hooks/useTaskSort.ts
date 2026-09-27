import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

import { TASK_SORT_FIELDS, type SortOrder, type Task, type TaskSortField } from '@/types';
import { readEnum, withParams } from '@/utils/search-params';

import { TASK_PRIORITY_META } from '../constants';

const STATUS_ORDER = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;

export interface TaskSort {
  field: TaskSortField;
  order: SortOrder;
}

/** Sort state stored in `?sort=&order=` so sorted views are shareable. */
export function useTaskSort(defaultSort: TaskSort = { field: 'updatedAt', order: 'desc' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const field = readEnum(searchParams, 'sort', TASK_SORT_FIELDS) ?? defaultSort.field;
  const order = readEnum(searchParams, 'order', ['asc', 'desc'] as const) ?? defaultSort.order;

  const toggle = useCallback(
    (next: TaskSortField) => {
      const nextOrder: SortOrder = next === field ? (order === 'asc' ? 'desc' : 'asc') : 'asc';
      setSearchParams(
        (current) => withParams(current, { sort: next, order: nextOrder, page: null }),
        {
          replace: true,
        },
      );
    },
    [field, order, setSearchParams],
  );

  return { sort: { field, order }, toggle };
}

function compareNullable(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

/** Client-side sort used for project task lists (all tasks are loaded). */
export function sortTasks(tasks: readonly Task[], { field, order }: TaskSort): Task[] {
  const direction = order === 'asc' ? 1 : -1;
  return [...tasks].sort((a, b) => {
    let result = 0;
    switch (field) {
      case 'title':
        result = a.title.localeCompare(b.title);
        break;
      case 'status':
        result = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
        break;
      case 'priority':
        result = TASK_PRIORITY_META[a.priority].rank - TASK_PRIORITY_META[b.priority].rank;
        break;
      case 'dueDate':
        // Tasks without a due date always sort last.
        if (a.dueDate === null || b.dueDate === null) return compareNullable(a.dueDate, b.dueDate);
        result = compareNullable(a.dueDate, b.dueDate);
        break;
      case 'createdAt':
        result = compareNullable(a.createdAt, b.createdAt);
        break;
      case 'updatedAt':
        result = compareNullable(a.updatedAt, b.updatedAt);
        break;
    }
    return result * direction;
  });
}
