import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import {
  type GenerateReportJob,
  JobName,
  QueueName,
} from '../../infrastructure/queue/queue.constants.js';
import { ReportGeneratorService } from '../analytics/report-generator.service.js';

import { isFinalAttempt, logJobCompleted, logJobFailure } from './job-logging.js';

@Processor(QueueName.REPORTS, { concurrency: 2 })
export class ReportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportsProcessor.name);

  constructor(private readonly generator: ReportGeneratorService) {
    super();
  }

  async process(job: Job<GenerateReportJob>): Promise<void> {
    if (job.name !== JobName.GENERATE_REPORT)
      throw new Error(`Unknown job "${job.name}" on ${QueueName.REPORTS}`);
    const started = Date.now();
    await this.generator.generate(job.data.reportId);
    logJobCompleted(this.logger, job, Date.now() - started, { reportId: job.data.reportId });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<GenerateReportJob> | undefined, error: Error): Promise<void> {
    logJobFailure(this.logger, job, error);
    // Surface the failure to the requester once retries are exhausted.
    if (job && isFinalAttempt(job)) await this.generator.markFailed(job.data.reportId, error);
  }
}
