/** ISO-8601 timestamp, e.g. `2026-09-25T14:03:00.000Z`. */
export type ISODateTime = string;

/** Calendar date without time, e.g. `2026-09-25`. Used for due/start dates. */
export type ISODate = string;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Envelope used by offset-paginated list endpoints. */
export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Envelope used by cursor-paginated feeds (activity, notifications). */
export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}

export interface CursorParams {
  cursor?: string;
  limit?: number;
}

export type SortOrder = 'asc' | 'desc';

/** Error body returned by the API for any non-2xx response. */
export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
}
