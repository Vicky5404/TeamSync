import { HttpException, HttpStatus } from '@nestjs/common';

/** Stable, machine-readable error codes shared with the web client (`lib/http/errors.ts`). */
export const ErrorCode = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  INTERNAL: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  // Domain-specific
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type FieldErrors = Record<string, string[]>;

/** Body of every non-2xx response (mirrors `ApiErrorBody` in the web client). */
export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors?: FieldErrors;
  requestId?: string;
}

/** HTTP exception carrying a stable error code and optional per-field messages. */
export class ApiException extends HttpException {
  readonly code: string;
  readonly fieldErrors: FieldErrors | undefined;

  constructor(status: HttpStatus, code: string, message: string, fieldErrors?: FieldErrors) {
    super({ code, message, ...(fieldErrors ? { fieldErrors } : {}) }, status);
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

/** Factories for the errors services throw. Keep messages user-presentable. */
export const Errors = {
  badRequest: (message: string, code: string = ErrorCode.BAD_REQUEST) =>
    new ApiException(HttpStatus.BAD_REQUEST, code, message),

  unauthorized: (
    message = 'Your session has expired. Please sign in again.',
    code: string = ErrorCode.UNAUTHORIZED,
  ) => new ApiException(HttpStatus.UNAUTHORIZED, code, message),

  forbidden: (
    message = "You don't have permission to perform this action.",
    code: string = ErrorCode.FORBIDDEN,
  ) => new ApiException(HttpStatus.FORBIDDEN, code, message),

  /** 404 — also used instead of 403 when revealing existence would leak information. */
  notFound: (resource = 'Resource') =>
    new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, `${resource} not found.`),

  conflict: (message: string, fieldErrors?: FieldErrors) =>
    new ApiException(HttpStatus.CONFLICT, ErrorCode.CONFLICT, message, fieldErrors),

  validation: (fieldErrors: FieldErrors, message = 'Some fields are invalid.') =>
    new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.VALIDATION, message, fieldErrors),

  /** Shorthand for a single-field validation error. */
  field: (field: string, message: string) => Errors.validation({ [field]: [message] }),

  tooManyRequests: (message: string, code: string = ErrorCode.RATE_LIMITED) =>
    new ApiException(HttpStatus.TOO_MANY_REQUESTS, code, message),

  payloadTooLarge: (message: string) =>
    new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, ErrorCode.PAYLOAD_TOO_LARGE, message),

  unsupportedMediaType: (message: string, field = 'file') =>
    new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ErrorCode.UNSUPPORTED_MEDIA_TYPE, message, {
      [field]: [message],
    }),

  serviceUnavailable: (message = 'The service is temporarily unavailable.') =>
    new ApiException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.SERVICE_UNAVAILABLE, message),
} as const;
