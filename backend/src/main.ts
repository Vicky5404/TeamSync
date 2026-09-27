import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap/configure-app.js';
import { WS_PATH } from './modules/realtime/realtime.gateway.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // Body parsers are registered in configureApp with explicit size limits.
    bodyParser: false,
  });
  const config = configureApp(app);
  await app.listen(config.http.port, '0.0.0.0');

  const base = `http://localhost:${config.http.port}`;
  const logger = new Logger('Bootstrap');
  logger.log(
    `API listening on ${base}/${config.http.prefix} (WebSocket ${WS_PATH}, health /health)`,
  );
  if (config.http.swaggerEnabled)
    logger.log(`API docs at ${base}/${config.http.prefix}/${config.http.swaggerPath}`);
  if (config.workers.runInApi) logger.log('Background workers are running inside the API process');
}

void bootstrap();
