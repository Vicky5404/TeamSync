import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { renderEmail } from '../../infrastructure/mail/email-templates.js';
import { MailService } from '../../infrastructure/mail/mail.service.js';
import {
  JobName,
  QueueName,
  type SendEmailJob,
} from '../../infrastructure/queue/queue.constants.js';

import { logJobCompleted, logJobFailure } from './job-logging.js';

/** Sends transactional email with retries and exponential backoff (SMTP outages are expected). */
@Processor(QueueName.EMAIL, { concurrency: 5 })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mail: MailService) {
    super();
  }

  async process(job: Job<SendEmailJob>): Promise<void> {
    if (job.name !== JobName.SEND_EMAIL)
      throw new Error(`Unknown job "${job.name}" on ${QueueName.EMAIL}`);
    const started = Date.now();
    await this.mail.send(job.data.to, renderEmail(job.data));
    logJobCompleted(this.logger, job, Date.now() - started, { template: job.data.template });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    logJobFailure(this.logger, job, error);
  }
}
