import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { JobName, QueueName } from '../../infrastructure/queue/queue.constants.js';

interface Schedule {
  queue: Queue;
  name: string;
  /** Cron pattern (UTC). */
  pattern: string;
}

/**
 * Registers repeatable jobs. `upsertJobScheduler` is idempotent, so every worker
 * instance can run this on startup without creating duplicates.
 */
@Injectable()
export class JobSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobSchedulerService.name);

  constructor(
    @InjectQueue(QueueName.NOTIFICATIONS) private readonly notifications: Queue,
    @InjectQueue(QueueName.MAINTENANCE) private readonly maintenance: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const schedules: Schedule[] = [
      { queue: this.notifications, name: JobName.SCAN_DUE_SOON, pattern: '5 * * * *' },
      { queue: this.maintenance, name: JobName.CLEANUP_PENDING_UPLOADS, pattern: '35 * * * *' },
      { queue: this.maintenance, name: JobName.CLEANUP_SESSIONS, pattern: '0 3 * * *' },
      { queue: this.maintenance, name: JobName.CLEANUP_TOKENS, pattern: '10 3 * * *' },
      { queue: this.maintenance, name: JobName.CLEANUP_NOTIFICATIONS, pattern: '20 3 * * *' },
      { queue: this.maintenance, name: JobName.CLEANUP_REPORTS, pattern: '30 3 * * *' },
      { queue: this.maintenance, name: JobName.PURGE_TRASH, pattern: '40 3 * * *' },
      { queue: this.maintenance, name: JobName.CLEANUP_AUDIT_LOGS, pattern: '50 3 * * *' },
    ];
    for (const { queue, name, pattern } of schedules) {
      try {
        await queue.upsertJobScheduler(name, { pattern, tz: 'UTC' }, { name, data: {} });
      } catch (error) {
        this.logger.error(
          { err: error, queue: queue.name, job: name },
          'Failed to register job scheduler',
        );
      }
    }
    this.logger.log(`Registered ${schedules.length} scheduled jobs`);
  }
}
