import { ValidationPipe, type ValidationError } from '@nestjs/common';

import { Errors, type FieldErrors } from '../errors/api-exception.js';

/** Flatten nested class-validator errors into `{ "path.to.field": [messages] }`. */
export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldErrors {
  const result: FieldErrors = {};
  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const messages = Object.values(error.constraints ?? {});
    if (messages.length > 0) result[path] = [...(result[path] ?? []), ...messages];
    if (error.children?.length) {
      Object.assign(result, flattenValidationErrors(error.children, path));
    }
  }
  return result;
}

/**
 * Global request validation: strips unknown properties, rejects requests that
 * send them, transforms payloads into DTO instances and reports failures as
 * `422 VALIDATION_ERROR` with per-field messages.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    validationError: { target: false, value: false },
    exceptionFactory: (errors) => Errors.validation(flattenValidationErrors(errors)),
  });
}
