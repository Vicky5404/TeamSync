import { buildMessage, ValidateBy, type ValidationOptions } from 'class-validator';

import { isISODate } from '../utils/dates.js';

/** A real calendar date in `YYYY-MM-DD` form (rejects e.g. `2026-02-30`). */
export function IsCalendarDate(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isCalendarDate',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isISODate(value),
        defaultMessage: buildMessage(
          (prefix) => `${prefix}$property must be a valid date (YYYY-MM-DD)`,
          options,
        ),
      },
    },
    options,
  );
}
