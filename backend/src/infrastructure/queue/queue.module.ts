import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import { AppConfig } from '../../config/app-config.js';

import { QUEUE_DEFAULT_JOB_OPTIONS, QueueName } from './queue.constants.js';
import { QueueService } from './queue.service.js';

const queues = Object.values(QueueName).map((name) =>
  BullModule.registerQueue({ name, defaultJobOptions: QUEUE_DEFAULT_JOB_OPTIONS[name] }),
);

/**
 * BullMQ producers (every process) — processors are registered separately in
 * `WorkersModule` so the API only runs them when explicitly enabled.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        // BullMQ requires `maxRetriesPerRequest: null` for blocking worker connections.
        connection: { url: config.redis.url, maxRetriesPerRequest: null },
        prefix: 'bull',
      }),
    }),
    ...queues,
  ],
  providers: [QueueService],
  exports: [QueueService, ...queues],
})
export class QueueModule {}
