import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { ApiException, type ApiErrorBody, ErrorCode } from '../errors/api-exception.js';
import { isPrismaError, PrismaErrorCode } from '../errors/prisma-errors.js';

const DEFAULT_CODES: Partial<Record<number, string>> = {
  400: ErrorCode.BAD_REQUEST,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  413: ErrorCode.PAYLOAD_TOO_LARGE,
  415: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
  422: ErrorCode.VALIDATION,
  429: ErrorCode.RATE_LIMITED,
  503: ErrorCode.SERVICE_UNAVAILABLE,
};

const DEFAULT_MESSAGES: Partial<Record<number, string>> = {
  400: 'The request was invalid.',
  401: 'Authentication is required.',
  403: "You don't have permission to perform this action.",
  404: 'The requested resource could not be found.',
  409: 'This change conflicts with the current state. Refresh and try again.',
  413: 'The request is too large.',
  429: 'Too many requests. Please slow down and try again shortly.',
  500: 'Something went wrong on our side. Please try again.',
  503: 'The service is temporarily unavailable.',
};

interface ErrorResponse {
  status: number;
  body: ApiErrorBody;
}

function messageFromHttpException(exception: HttpException, status: number): string {
  const response = exception.getResponse();
  if (typeof response === 'string') return response;
  const message = (response as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map(String).join('. ');
  return DEFAULT_MESSAGES[status] ?? exception.message;
}

/**
 * Converts every error into the API error contract:
 * `{ code, message, fieldErrors?, requestId }` with a proper status code.
 * Unexpected errors are logged with their stack and never leak internals.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      // WebSocket errors are handled inside the gateway.
      this.logger.error(exception);
      return;
    }

    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const { status, body } = this.toErrorResponse(exception);
    const requestId = typeof request.id === 'string' ? request.id : undefined;

    if (status >= 500) {
      this.logger.error(
        {
          err: exception,
          requestId,
          method: request.method,
          path: request.path,
          ...(request.user ? { userId: request.user.id } : {}),
          ...(request.access ? { organizationId: request.access.organizationId } : {}),
        },
        'Unhandled error while processing request',
      );
    }

    if (response.headersSent) return;
    response.status(status).json({ ...body, ...(requestId ? { requestId } : {}) });
  }

  private toErrorResponse(exception: unknown): ErrorResponse {
    if (exception instanceof ApiException) {
      return {
        status: exception.getStatus(),
        body: {
          code: exception.code,
          message: exception.message,
          ...(exception.fieldErrors ? { fieldErrors: exception.fieldErrors } : {}),
        },
      };
    }

    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        body: { code: ErrorCode.RATE_LIMITED, message: DEFAULT_MESSAGES[429] ?? '' },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const message =
        exception instanceof NotFoundException && exception.message.startsWith('Cannot ')
          ? 'Route not found.'
          : status >= 500
            ? (DEFAULT_MESSAGES[500] ?? '')
            : messageFromHttpException(exception, status);
      return {
        status,
        body: { code: DEFAULT_CODES[status] ?? ErrorCode.INTERNAL, message },
      };
    }

    if (isPrismaError(exception)) {
      switch (exception.code) {
        case PrismaErrorCode.UNIQUE_VIOLATION:
          return {
            status: HttpStatus.CONFLICT,
            body: {
              code: ErrorCode.CONFLICT,
              message: 'A record with these values already exists.',
            },
          };
        case PrismaErrorCode.RECORD_NOT_FOUND:
        case PrismaErrorCode.INVALID_VALUE:
          return {
            status: HttpStatus.NOT_FOUND,
            body: { code: ErrorCode.NOT_FOUND, message: DEFAULT_MESSAGES[404] ?? '' },
          };
        case PrismaErrorCode.FOREIGN_KEY_VIOLATION:
        case PrismaErrorCode.TRANSACTION_CONFLICT:
          return {
            status: HttpStatus.CONFLICT,
            body: { code: ErrorCode.CONFLICT, message: DEFAULT_MESSAGES[409] ?? '' },
          };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: ErrorCode.INTERNAL, message: DEFAULT_MESSAGES[500] ?? '' },
    };
  }
}
