import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';

import { ApiError, ERROR_CODES, getErrorMessage, toApiError } from './errors';

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;

function responseError(status: number, data: unknown, headers: Record<string, string> = {}) {
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, {
    status,
    statusText: '',
    data,
    headers,
    config,
  });
}

describe('toApiError', () => {
  it('keeps the API error contract (code, message, field errors, request id)', () => {
    const error = toApiError(
      responseError(422, {
        code: 'VALIDATION_ERROR',
        message: 'Some fields are invalid.',
        fieldErrors: { title: ['Title is required'] },
        requestId: 'req-12345678',
      }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Some fields are invalid.',
      fieldErrors: { title: ['Title is required'] },
      requestId: 'req-12345678',
    });
    expect(error.isValidationError).toBe(true);
    expect(error.isRetryable).toBe(false);
  });

  it('falls back to status-based messages for non-API bodies (e.g. a proxy error page)', () => {
    const error = toApiError(
      responseError(502, '<html>Bad gateway</html>', { 'x-request-id': 'abc12345' }),
    );
    expect(error.status).toBe(502);
    expect(error.message).toBe('The service is temporarily unavailable.');
    expect(error.requestId).toBe('abc12345');
    expect(error.isRetryable).toBe(true);
  });

  it('maps missing responses and timeouts to network errors', () => {
    const network = toApiError(new AxiosError('Network Error', 'ERR_NETWORK', config));
    expect(network.code).toBe(ERROR_CODES.NETWORK);
    expect(network.isNetworkError).toBe(true);

    const timeout = toApiError(new AxiosError('timeout', 'ECONNABORTED', config));
    expect(timeout.code).toBe(ERROR_CODES.TIMEOUT);
    expect(timeout.isRetryable).toBe(true);
  });

  it('classifies authorization failures', () => {
    expect(
      toApiError(responseError(401, { code: 'UNAUTHORIZED', message: 'x' })).isUnauthorized,
    ).toBe(true);
    expect(toApiError(responseError(403, { code: 'FORBIDDEN', message: 'x' })).isForbidden).toBe(
      true,
    );
    expect(toApiError(responseError(404, { code: 'NOT_FOUND', message: 'x' })).isNotFound).toBe(
      true,
    );
  });

  it('returns ApiError instances unchanged and wraps anything else', () => {
    const original = new ApiError('boom', { status: 500, code: 'INTERNAL_ERROR' });
    expect(toApiError(original)).toBe(original);
    expect(toApiError(new Error('plain')).message).toBe('plain');
    expect(getErrorMessage('nope', 'fallback')).toBe('fallback');
  });
});
