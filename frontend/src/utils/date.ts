const DAY_MS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let cached = formatterCache.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(undefined, options);
    formatterCache.set(key, cached);
  }
  return cached;
}

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/**
 * Parse an API date value. Date-only strings (`YYYY-MM-DD`) are interpreted in
 * the user's local time zone so a due date never shifts by a day.
 */
export function parseDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (DATE_ONLY.test(value)) {
    const [year, month, day] = value.split('-').map(Number) as [number, number, number];
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

/** Format a Date as a local calendar date string (`YYYY-MM-DD`). */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Whole days from today until the given date (negative when in the past). */
export function daysUntil(value: string | Date): number {
  const target = startOfDay(parseDate(value)).getTime();
  const today = startOfDay(new Date()).getTime();
  return Math.round((target - today) / DAY_MS);
}

export function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = parseDate(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return formatter(
    options ?? { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) },
  ).format(date);
}

export function formatLongDate(value: string | Date): string {
  return formatter({ dateStyle: 'medium' }).format(parseDate(value));
}

export function formatDateTime(value: string | Date): string {
  return formatter({ dateStyle: 'medium', timeStyle: 'short' }).format(parseDate(value));
}

export function formatTime(value: string | Date): string {
  return formatter({ timeStyle: 'short' }).format(parseDate(value));
}

/** "just now", "5 min ago", "yesterday", falling back to a date after a week. */
export function formatRelativeTime(value: string | Date): string {
  const date = parseDate(value);
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);

  if (abs < 45) return 'just now';
  if (abs < 3600) return relativeFormatter.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 86_400) return relativeFormatter.format(Math.round(diffSeconds / 3600), 'hour');
  if (abs < 7 * 86_400) return relativeFormatter.format(Math.round(diffSeconds / 86_400), 'day');
  return formatDate(date);
}

/** Human description of a due date relative to today. */
export function formatDueDate(value: string): string {
  const days = daysUntil(value);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return formatDate(value);
}

export type DueState = 'overdue' | 'today' | 'soon' | 'later';

export function getDueState(dueDate: string): DueState {
  const days = daysUntil(dueDate);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 3) return 'soon';
  return 'later';
}

export function isOverdue(dueDate: string | null, completed = false): boolean {
  return !completed && dueDate !== null && daysUntil(dueDate) < 0;
}

export type DateGroup = 'Today' | 'Yesterday' | 'This week' | 'Earlier';

/** Bucket a timestamp for grouped feeds (notifications, activity). */
export function getDateGroup(value: string | Date): DateGroup {
  const days = -daysUntil(parseDate(value));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'This week';
  return 'Earlier';
}

export function groupByDate<T>(items: readonly T[], getDate: (item: T) => string) {
  const groups = new Map<DateGroup, T[]>();
  for (const item of items) {
    const group = getDateGroup(getDate(item));
    const bucket = groups.get(group);
    if (bucket) bucket.push(item);
    else groups.set(group, [item]);
  }
  return Array.from(groups, ([label, entries]) => ({ label, items: entries }));
}

/** Time-of-day greeting in the user's local time. */
export function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Current wall-clock time in another time zone (falls back to local time). */
export function formatCurrentTimeInZone(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { timeStyle: 'short', timeZone }).format(new Date());
  } catch {
    return formatTime(new Date());
  }
}

export function currentYear(): number {
  return new Date().getFullYear();
}
