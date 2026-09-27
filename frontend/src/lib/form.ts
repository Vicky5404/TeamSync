import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiError, getErrorMessage } from '@/lib/http';

/**
 * Surface an API error inside a React Hook Form: server-side field errors are
 * mapped onto matching fields; anything else becomes `errors.root.server`.
 */
export function applyFormError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): void {
  if (error instanceof ApiError) {
    const entries = Object.entries(error.fieldErrors);
    if (entries.length > 0) {
      entries.forEach(([field, messages], index) => {
        setError(
          field as Path<T>,
          { type: 'server', message: messages[0] ?? 'Invalid value' },
          { shouldFocus: index === 0 },
        );
      });
      return;
    }
  }
  setError('root.server', { type: 'server', message: getErrorMessage(error) });
}
