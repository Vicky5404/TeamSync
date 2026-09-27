import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import type { AccessContext, AuthUser } from '../../common/auth/auth.types.js';
import { AppConfig } from '../../config/app-config.js';

import { logBase, sanitizeUrl } from './log-context.js';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

/** Never log credentials, tokens, cookies or email addresses — anywhere in a log object. */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.authorization',
  '*.cookie',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.passwordHash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.email',
];

type LoggedRequest = IncomingMessage & { user?: AuthUser; access?: AccessContext; ip?: string };

/** Honour a well-formed incoming `X-Request-Id` (for tracing), otherwise mint one. */
function requestId(request: IncomingMessage, response: ServerResponse): string {
  const header = request.headers['x-request-id'];
  const id = typeof header === 'string' && REQUEST_ID_PATTERN.test(header) ? header : randomUUID();
  response.setHeader('X-Request-Id', id);
  return id;
}

/**
 * Structured JSON logging (pino). Every line carries `service`, `env` and
 * `version`; request logs add the request id (`req.id`, also returned as
 * `X-Request-Id`), method, path, status, `durationMs`, and — once known — the
 * `userId` and `organizationId`. Secrets and personal data are redacted.
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.logging.level,
          base: logBase(config.nodeEnv),
          ...(config.logging.pretty
            ? {
                transport: {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
                },
              }
            : {}),
          genReqId: requestId,
          redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
          customAttributeKeys: { responseTime: 'durationMs' },
          autoLogging: {
            ignore: (request: IncomingMessage) => request.url?.startsWith('/health') ?? false,
          },
          customLogLevel: (_request: IncomingMessage, response: ServerResponse, error?: Error) =>
            error || response.statusCode >= 500
              ? 'error'
              : response.statusCode >= 400
                ? 'warn'
                : 'info',
          // Evaluated again when the response completes, after authentication and
          // organization access have been resolved.
          customProps: (request: IncomingMessage) => {
            const { user, access } = request as LoggedRequest;
            return {
              ...(user ? { userId: user.id } : {}),
              ...(access ? { organizationId: access.organizationId } : {}),
            };
          },
          serializers: {
            req: (request: {
              id: unknown;
              method: string;
              url: string;
              remoteAddress?: string;
              raw?: LoggedRequest;
            }) => ({
              id: request.id,
              method: request.method,
              url: sanitizeUrl(request.url),
              // Express resolves the client address through `trust proxy`.
              ip: request.raw?.ip ?? request.remoteAddress,
            }),
            res: (response: { statusCode: number }) => ({ statusCode: response.statusCode }),
          },
        },
      }),
    }),
  ],
})
export class LoggerModule {}
