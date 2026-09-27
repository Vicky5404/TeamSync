import 'reflect-metadata';

import { createServer, type Server } from 'node:http';

import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppConfig } from './config/app-config.js';
import { setServiceName } from './infrastructure/logger/log-context.js';
import { HealthService } from './modules/health/health.service.js';
import { WorkerModule } from './worker.module.js';

/**
 * Probes for orchestrators (Docker, Kubernetes): `GET /health/live` answers
 * while the process runs, `GET /health` also checks PostgreSQL and Redis.
 * Nothing else is served — the worker has no public API.
 */
function startHealthServer(health: HealthService, port: number): Server {
  const server = createServer((request, response) => {
    const send = (status: number, body: object) => {
      response.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      response.end(JSON.stringify(body));
    };
    if (request.method !== 'GET') return send(405, { status: 'error' });
    if (request.url === '/health/live') return send(200, { status: 'ok' });
    if (request.url === '/health') {
      void health
        .check()
        .then((report) => send(report.status === 'ok' ? 200 : 503, report))
        .catch(() => send(503, { status: 'error' }));
      return;
    }
    send(404, { status: 'error' });
  });
  server.listen(port, '0.0.0.0');
  return server;
}

/** Dedicated BullMQ worker process (no HTTP API). Scale horizontally as needed. */
async function bootstrap(): Promise<void> {
  setServiceName('flowsync-worker');
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  await app.init();

  const logger = new NestLogger('Worker');
  const { healthPort } = app.get(AppConfig).workers;
  if (healthPort > 0) {
    const server = startHealthServer(app.get(HealthService), healthPort);
    process.once('SIGTERM', () => server.close());
    process.once('SIGINT', () => server.close());
    logger.log(`Background workers started (health on :${healthPort}/health)`);
  } else {
    logger.log('Background workers started');
  }
}

void bootstrap();
