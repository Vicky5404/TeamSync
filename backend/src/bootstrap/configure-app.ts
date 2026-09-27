import { type INestApplication, RequestMethod } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { WsAdapter } from '@nestjs/platform-ws';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter.js';
import { createValidationPipe } from '../common/pipes/validation.pipe.js';
import { AppConfig } from '../config/app-config.js';
import { parseClientMessage } from '../modules/realtime/ws-message-parser.js';

import { setupSwagger } from './swagger.js';

const BODY_LIMIT = '1mb';

/**
 * HTTP pipeline shared by `main.ts` and end-to-end tests: security headers,
 * CORS, cookies, body limits, validation, error format, routing and docs.
 */
export function configureApp(app: NestExpressApplication): AppConfig {
  const config = app.get(AppConfig);

  app.useLogger(app.get(Logger));
  app.set('trust proxy', config.http.trustProxy);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        // Only relevant to the Swagger UI page; don't force HTTPS on local HTTP.
        directives: { upgradeInsecureRequests: config.isProduction ? [] : null },
      },
      // JSON API: nothing may embed or frame it; avatar redirects override CORP per route.
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: config.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );
  app.use(cookieParser());
  app.useBodyParser('json', { limit: BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: BODY_LIMIT, extended: false });

  const allowedOrigins = new Set(config.http.corsOrigins);
  app.enableCors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
  });

  app.setGlobalPrefix(config.http.prefix, {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/live', method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useWebSocketAdapter(new WsAdapter(app, { messageParser: parseClientMessage }));
  app.enableShutdownHooks();

  if (config.http.swaggerEnabled) setupSwagger(app as INestApplication, config);
  return config;
}
