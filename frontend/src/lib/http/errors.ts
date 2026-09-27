import axios from 'axios';

import type { ApiErrorBody } from '@/types';

export const ERROR_CODES = {
  NETWORK: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  CANCELED: 'CANCELED',
  UNKNOWN: 'UNKNOWN_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION_ERROR',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

interface ApiErrorOptions {
  status: number;
  code: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
  cause?: unknown;
}

/** Normalized error thrown by every API call. UI code only ever handles this type. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string[]>;
  readonly requestId: string | undefined;

  constructor(message: string, options: ApiErrorOptions) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.fieldErrors = options.fieldErrors ?? {};
    this.requestId = options.requestId;
  }

  get isNetworkError(): boolean {
    return this.code === ERROR_CODES.NETWORK || this.code === ERROR_CODES.TIMEOUT;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isValidationError(): boolean {
    return this.status === 422 || this.code === ERROR_CODES.VALIDATION;
  }

  get isRetryable(): boolean {
    return this.isNetworkError || this.status >= 500 || this.status === 429 || this.status === 408;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'The request was invalid.',
  401: 'Your session has expired. Please sign in again.',
  403: "You don't have permission to perform this action.",
  404: 'The requested resource could not be found.',
  409: 'This change conflicts with the current state. Refresh and try again.',
  413: 'The file or request is too large.',
  415: 'This file type is not supported.',
  422: 'Some fields are invalid.',
  429: 'Too many requests. Please slow down and try again shortly.',
  500: 'Something went wrong on our side. Please try again.',
  502: 'The service is temporarily unavailable.',
  503: 'The service is temporarily unavailable.',
  504: 'The server took too long to respond.',
};

const DEFAULT_CODES: Record<number, string> = {
  401: ERROR_CODES.UNAUTHORIZED,
  403: ERROR_CODES.FORBIDDEN,
  404: ERROR_CODES.NOT_FOUND,
  422: ERROR_CODES.VALIDATION,
  429: ERROR_CODES.RATE_LIMITED,
};

/** Convert anything thrown by Axios (or elsewhere) into an `ApiError`. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isCancel(error)) {
    return new ApiError('The request was canceled.', {
      status: 0,
      code: ERROR_CODES.CANCELED,
      cause: error,
    });
  }

  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError('The request timed out. Check your connection and try again.', {
        status: 0,
        code: ERROR_CODES.TIMEOUT,
        cause: error,
      });
    }

    const response = error.response;
    if (!response) {
      return new ApiError('Unable to reach the server. Check your connection and try again.', {
        status: 0,
        code: ERROR_CODES.NETWORK,
        cause: error,
      });
    }

    const body: unknown = response.data;
    const requestIdHeader: unknown = response.headers['x-request-id'];
    const requestId = typeof requestIdHeader === 'string' ? requestIdHeader : undefined;

    if (isApiErrorBody(body)) {
      return new ApiError(body.message, {
        status: response.status,
        code: body.code || DEFAULT_CODES[response.status] || ERROR_CODES.UNKNOWN,
        fieldErrors: body.fieldErrors,
        requestId: body.requestId ?? requestId,
        cause: error,
      });
    }

    return new ApiError(STATUS_MESSAGES[response.status] ?? 'An unexpected error occurred.', {
      status: response.status,
      code: DEFAULT_CODES[response.status] ?? ERROR_CODES.UNKNOWN,
      requestId,
      cause: error,
    });
  }

  return new ApiError(error instanceof Error ? error.message : 'An unexpected error occurred.', {
    status: 0,
    code: ERROR_CODES.UNKNOWN,
    cause: error,
  });
}

/** Human-readable message for any error value. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
