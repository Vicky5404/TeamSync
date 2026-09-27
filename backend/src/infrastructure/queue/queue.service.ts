import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';

import {
  type DeleteStorageObjectsJob,
  type DeliverNotificationsJob,
  type GenerateReportJob,
  JobName,
  type NotificationIntent,
  type PurgeStoragePrefixJob,
  QueueName,
  type SendEmailJob,
} from './queue.constants.js';

const DELETE_BATCH_SIZE = 500;
const ENQUEUE_TIMEOUT_MS = 3_000;

/**
 * BullMQ connections queue commands while Redis is unreachable; bound the wait
 * so a Redis outage can't hang HTTP requests.
 */
async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timed out enqueueing job')), ENQUEUE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Typed producer API. Enqueueing side effects (emails, notifications, cleanup)
 * is best-effort from the request's point of view: failures are logged and
 * never fail the user's action, which has already been committed.
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QueueName.NOTIFICATIONS) private readonly notifications: Queue,
    @InjectQueue(QueueName.EMAIL) private readonly email: Queue,
    @InjectQueue(QueueName.REPORTS) private readonly reports: Queue,
    @InjectQueue(QueueName.MAINTENANCE) private readonly maintenance: Queue,
  ) {}

  async deliverNotifications(intents: NotificationIntent[]): Promise<void> {
    if (intents.length === 0) return;
    await this.safeAdd(this.notifications, JobName.DELIVER_NOTIFICATIONS, {
      intents,
    } satisfies DeliverNotificationsJob);
  }

  async sendEmail(job: SendEmailJob): Promise<void> {
    await this.safeAdd(this.email, JobName.SEND_EMAIL, job);
  }

  /** Report generation must be enqueued reliably, so errors propagate to the caller. */
  async generateReport(reportId: string): Promise<void> {
    await withTimeout(
      this.reports.add(JobName.GENERATE_REPORT, { reportId } satisfies GenerateReportJob, {
        jobId: `report-${reportId}`,
      }),
    );
  }

  async purgeStoragePrefix(prefix: string): Promise<void> {
    await this.safeAdd(this.maintenance, JobName.PURGE_STORAGE_PREFIX, {
      prefix,
    } satisfies PurgeStoragePrefixJob);
  }

  async deleteStorageObjects(keys: string[]): Promise<void> {
    for (let index = 0; index < keys.length; index += DELETE_BATCH_SIZE) {
      await this.safeAdd(this.maintenance, JobName.DELETE_STORAGE_OBJECTS, {
        keys: keys.slice(index, index + DELETE_BATCH_SIZE),
      } satisfies DeleteStorageObjectsJob);
    }
  }

  private async safeAdd(queue: Queue, name: string, data: object): Promise<void> {
    try {
      await withTimeout(queue.add(name, data));
    } catch (error) {
      this.logger.error({ err: error, queue: queue.name, job: name }, 'Failed to enqueue job');
    }
  }
}
