import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import {
  DUE_PRESETS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type DuePreset,
  type TaskFilters,
  type TaskPriority,
  type TaskStatus,
} from '@/types';
import { readEnum, readISODate, readList, readString, withParams } from '@/utils/search-params';

/** URL query keys for shareable task filters. */
export const TASK_FILTER_PARAMS = {
  search: 'q',
  status: 'status',
  priority: 'priority',
  assignee: 'assignee',
  labels: 'label',
  due: 'due',
  dueFrom: 'from',
  dueTo: 'to',
} as const;

export interface TaskFilterState {
  search: string;
  status: TaskStatus[];
  priority: TaskPriority[];
  assignee: string[];
  labels: string[];
  due: DuePreset | undefined;
  dueFrom: string | undefined;
  dueTo: string | undefined;
}

type ListFilterKey = 'status' | 'priority' | 'assignee' | 'labels';

function parseFilters(params: URLSearchParams): TaskFilterState {
  return {
    search: readString(params, TASK_FILTER_PARAMS.search),
    status: readList(params, TASK_FILTER_PARAMS.status, TASK_STATUSES),
    priority: readList(params, TASK_FILTER_PARAMS.priority, TASK_PRIORITIES),
    assignee: readList(params, TASK_FILTER_PARAMS.assignee),
    labels: readList(params, TASK_FILTER_PARAMS.labels),
    due: readEnum(params, TASK_FILTER_PARAMS.due, DUE_PRESETS),
    dueFrom: readISODate(params, TASK_FILTER_PARAMS.dueFrom),
    dueTo: readISODate(params, TASK_FILTER_PARAMS.dueTo),
  };
}

/** Compact API filter object — omits empty values so query keys stay stable. */
export function toApiFilters(state: TaskFilterState): TaskFilters {
  const filters: TaskFilters = {};
  if (state.search) filters.search = state.search;
  if (state.status.length) filters.status = state.status;
  if (state.priority.length) filters.priority = state.priority;
  if (state.assignee.length) filters.assignee = state.assignee;
  if (state.labels.length) filters.labels = state.labels;
  if (state.due) filters.due = state.due;
  if (state.dueFrom) filters.dueFrom = state.dueFrom;
  if (state.dueTo) filters.dueTo = state.dueTo;
  return filters;
}

/**
 * Task filters stored in the URL (shareable, survive reloads and back/forward).
 * Search text is handled separately with a debounce (see `useDebouncedSearchParam`).
 */
export function useTaskFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const serialized = searchParams.toString();

  const state = useMemo(() => parseFilters(new URLSearchParams(serialized)), [serialized]);
  const apiFilters = useMemo(() => toApiFilters(state), [state]);

  const update = useCallback(
    (updates: Record<string, string | readonly string[] | null | undefined>) => {
      setSearchParams((current) => withParams(current, { ...updates, page: null }), {
        replace: true,
      });
    },
    [setSearchParams],
  );

  const setList = useCallback(
    (key: ListFilterKey, values: readonly string[]) =>
      update({ [TASK_FILTER_PARAMS[key]]: values }),
    [update],
  );

  const setDue = useCallback(
    (due: DuePreset | undefined, range?: { from?: string; to?: string }) =>
      update({
        [TASK_FILTER_PARAMS.due]: due ?? null,
        [TASK_FILTER_PARAMS.dueFrom]: due ? null : (range?.from ?? null),
        [TASK_FILTER_PARAMS.dueTo]: due ? null : (range?.to ?? null),
      }),
    [update],
  );

  const clear = useCallback(
    () =>
      update(Object.fromEntries(Object.values(TASK_FILTER_PARAMS).map((param) => [param, null]))),
    [update],
  );

  const activeCount =
    (state.search ? 1 : 0) +
    (state.status.length ? 1 : 0) +
    (state.priority.length ? 1 : 0) +
    (state.assignee.length ? 1 : 0) +
    (state.labels.length ? 1 : 0) +
    (state.due || state.dueFrom || state.dueTo ? 1 : 0);

  return { state, apiFilters, setList, setDue, clear, activeCount };
}
