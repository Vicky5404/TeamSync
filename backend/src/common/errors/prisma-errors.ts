import { Prisma } from '../../generated/prisma/client.js';

export const PrismaErrorCode = {
  UNIQUE_VIOLATION: 'P2002',
  FOREIGN_KEY_VIOLATION: 'P2003',
  INVALID_VALUE: 'P2023',
  RECORD_NOT_FOUND: 'P2025',
  TRANSACTION_CONFLICT: 'P2034',
} as const;

export function isPrismaError(
  error: unknown,
  code?: string,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (code === undefined || error.code === code)
  );
}

export function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return isPrismaError(error, PrismaErrorCode.UNIQUE_VIOLATION);
}

/**
 * Column names involved in a unique-constraint violation. Prisma reports them
 * as `meta.target` (native engine) or inside `meta.driverAdapterError`
 * (driver adapters), so both shapes are handled.
 */
export function uniqueViolationFields(error: Prisma.PrismaClientKnownRequestError): string[] {
  const meta: Record<string, unknown> = error.meta ?? {};
  const target = meta.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === 'string') return [target];
  const cause = (meta.driverAdapterError as { cause?: { constraint?: { fields?: unknown } } })
    ?.cause;
  const fields = cause?.constraint?.fields;
  return Array.isArray(fields) ? fields.map((field) => String(field).replace(/"/g, '')) : [];
}
