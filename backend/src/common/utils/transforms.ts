import type { TransformFnParams } from 'class-transformer';

/** `class-transformer` helpers for request DTOs. */

/** Trim strings; leave other values for the validators to reject. */
export const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Trim and lower-case (emails). */
export const normalizeEmail = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Trim; empty strings become `null` (optional nullable text fields). */
export const trimToNull = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/** Query strings: empty → undefined, otherwise trimmed. */
export const optionalQueryString = ({ value }: TransformFnParams): unknown => {
  const first: unknown = Array.isArray(value) ? (value as unknown[])[0] : value;
  if (typeof first !== 'string') return first;
  const trimmed = first.trim();
  return trimmed === '' ? undefined : trimmed;
};

/**
 * Query arrays: accepts repeated keys (`status=A&status=B`) and comma lists
 * (`status=A,B`); drops empty entries; empty result → undefined.
 */
export const queryArray = ({ value }: TransformFnParams): unknown => {
  if (value === undefined || value === null) return undefined;
  const items = (Array.isArray(value) ? value : [value])
    .flatMap((item: unknown) => (typeof item === 'string' ? item.split(',') : [item]))
    .map((item: unknown) => (typeof item === 'string' ? item.trim() : item))
    .filter((item: unknown) => item !== '');
  return items.length > 0 ? Array.from(new Set(items)) : undefined;
};
