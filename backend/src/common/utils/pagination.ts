import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../dto/pagination.dto.js';
import { Errors } from '../errors/api-exception.js';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Envelope for offset-paginated lists. */
export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

/** Envelope for cursor-paginated feeds. */
export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}

export interface PageWindow {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  totalPages: number;
}

/** Clamp the requested page into range for a result set of `total` items. */
export function pageWindow(total: number, page = 1, pageSize = DEFAULT_PAGE_SIZE): PageWindow {
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(pageSize)));
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(totalPages, Math.max(1, Math.trunc(page)));
  return { page: current, pageSize: size, skip: (current - 1) * size, take: size, totalPages };
}

export function paginated<T>(data: T[], total: number, window: PageWindow): Paginated<T> {
  return {
    data,
    meta: { page: window.page, pageSize: window.pageSize, total, totalPages: window.totalPages },
  };
}

// ---------------------------------------------------------------------------
// Keyset cursors over (createdAt DESC, id DESC)
// ---------------------------------------------------------------------------

export interface KeysetCursor {
  createdAt: Date;
  id: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCursor(row: KeysetCursor): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): KeysetCursor {
  const [timestamp, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const createdAt = new Date(timestamp ?? '');
  if (!id || !UUID_PATTERN.test(id) || Number.isNaN(createdAt.getTime())) {
    throw Errors.field('cursor', 'Invalid cursor');
  }
  return { createdAt, id };
}

/** Prisma `where` fragment selecting rows strictly after the cursor (DESC order). */
export function afterCursor(cursor: string | undefined) {
  if (!cursor) return {};
  const { createdAt, id } = decodeCursor(cursor);
  return {
    OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }],
  };
}

export const keysetOrder = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

/** Trim a `limit + 1` result set into a page and compute the next cursor. */
export function toCursorPage<Row extends KeysetCursor, T>(
  rows: Row[],
  limit: number,
  map: (row: Row) => T,
): CursorPage<T> {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  return { data: page.map(map), nextCursor: hasMore && last ? encodeCursor(last) : null };
}

export function resolveLimit(limit: number | undefined): number {
  return Math.min(MAX_PAGE_SIZE, Math.max(1, limit ?? DEFAULT_PAGE_SIZE));
}
