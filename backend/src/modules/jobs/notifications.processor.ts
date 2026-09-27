import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import {
  type DeliverNotificationsJob,
  JobName,
  QueueName,
} from '../../infrastructure/queue/queue.constants.js';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service.js';

import { logJobCompleted, logJobFailure } from './job-logging.js';

/** Persists + pushes in-app notifications, hands emails to the email queue, sends due-date reminders. */
@Processor(QueueName.NOTIFICATIONS, { concurrency: 10 })
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly delivery: NotificationDeliveryService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    const started = Date.now();
    switch (job.name) {
      case JobName.DELIVER_NOTIFICATIONS: {
        const result = await this.delivery.deliver((job.data as DeliverNotificationsJob).intents);
        logJobCompleted(this.logger, job, Date.now() - started, { ...result });
        return result;
      }
      case JobName.SCAN_DUE_SOON: {
        const reminders = await this.delivery.scanDueSoon();
        logJobCompleted(this.logger, job, Date.now() - started, { reminders });
        return { reminders };
      }
      default:
        throw new Error(`Unknown job "${job.name}" on ${QueueName.NOTIFICATIONS}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    logJobFailure(this.logger, job, error);
  }
}
