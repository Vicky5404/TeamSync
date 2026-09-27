import { type ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { describe, expect, it, vi } from 'vitest';

import { Prisma } from '../../generated/prisma/client.js';
import { Errors } from '../errors/api-exception.js';

import { AllExceptionsFilter } from './all-exceptions.filter.js';

function run(exception: unknown) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ id: 'req-1', method: 'GET', path: '/x' }),
      getResponse: () => ({ status, headersSent: false }),
    }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return {
    status: (status.mock.calls[0] as unknown[])[0],
    body: (json.mock.calls[0] as unknown[])[0],
  };
}

describe('AllExceptionsFilter', () => {
  it('serializes API exceptions with field errors and request id', () => {
    expect(run(Errors.validation({ email: ['Invalid'] }))).toEqual({
      status: 422,
      body: {
        code: 'VALIDATION_ERROR',
        message: 'Some fields are invalid.',
        fieldErrors: { email: ['Invalid'] },
        requestId: 'req-1',
      },
    });
  });

  it('maps framework exceptions to the error contract', () => {
    expect(run(new NotFoundException('Cannot GET /nope')).body).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Route not found.',
    });
    expect(run(new BadRequestException('Unexpected token')).body).toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(run(new ThrottlerException())).toMatchObject({
      status: 429,
      body: { code: 'RATE_LIMITED' },
    });
  });

  it('maps Prisma errors without leaking details', () => {
    const unique = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on secret_column',
      {
        code: 'P2002',
        clientVersion: 'test',
      },
    );
    const result = run(unique);
    expect(result.status).toBe(409);
    expect(JSON.stringify(result.body)).not.toContain('secret_column');
  });

  it('hides unexpected errors behind a generic 500', () => {
    const result = run(new Error('connection string postgres://user:password@db'));
    expect(result).toMatchObject({ status: 500, body: { code: 'INTERNAL_ERROR' } });
    expect(JSON.stringify(result.body)).not.toContain('password');
  });
});
