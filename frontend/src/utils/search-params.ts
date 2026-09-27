/**
 * Helpers for reading/writing typed values in URL query strings so filters
 * stay shareable and survive reloads. Multi-value params are comma-separated.
 */

export function readList<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed?: readonly T[],
): T[] {
  const raw = params.get(key);
  if (!raw) return [];
  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(values));
  return (
    allowed ? unique.filter((value) => (allowed as readonly string[]).includes(value)) : unique
  ) as T[];
}

export function readEnum<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const raw = params.get(key);
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
}

export function readString(params: URLSearchParams, key: string): string {
  return params.get(key)?.trim() ?? '';
}

export function readPositiveInt(params: URLSearchParams, key: string, fallback: number): number {
  const value = Number.parseInt(params.get(key) ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function readISODate(params: URLSearchParams, key: string): string | undefined {
  const raw = params.get(key);
  return raw && ISO_DATE.test(raw) ? raw : undefined;
}

/**
 * Return a copy of `params` with the given updates applied. `null`, `undefined`,
 * empty strings and empty arrays remove the key.
 */
export function withParams(
  params: URLSearchParams,
  updates: Record<string, string | number | readonly string[] | null | undefined>,
): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === '') {
      next.delete(key);
    } else if (Array.isArray(value)) {
      if (value.length === 0) next.delete(key);
      else next.set(key, value.join(','));
    } else {
      next.set(key, String(value));
    }
  }
  return next;
}
