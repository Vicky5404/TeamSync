export const DAY_MS = 86_400_000;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Calendar dates (due/start dates) are stored as PostgreSQL DATE, which the
 * driver materializes as UTC midnight. All date math here is therefore UTC.
 */
export function toISODate(date: Date): string;
export function toISODate(date: Date | null): string | null;
export function toISODate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export function isISODate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && toISODate(date) === value;
}

/** `YYYY-MM-DD` → Date at UTC midnight (the representation Prisma uses for DATE). */
export function fromISODate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function fromNullableISODate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : fromISODate(value);
}

/** Today at UTC midnight. */
export function startOfTodayUTC(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Last day (Sunday) of the current week, at UTC midnight. */
export function endOfWeekUTC(now = new Date()): Date {
  const today = startOfTodayUTC(now);
  return addDays(today, (7 - today.getUTCDay()) % 7);
}
