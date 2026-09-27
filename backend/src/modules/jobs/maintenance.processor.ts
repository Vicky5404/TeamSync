import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import {
  type DeleteStorageObjectsJob,
  JobName,
  type PurgeStoragePrefixJob,
  QueueName,
} from '../../infrastructure/queue/queue.constants.js';

import { logJobCompleted, logJobFailure } from './job-logging.js';
import { MaintenanceService } from './maintenance.service.js';

/** Scheduled cleanup and asynchronous object-storage deletion. */
@Processor(QueueName.MAINTENANCE, { concurrency: 2 })
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(private readonly maintenance: MaintenanceService) {
    super();
  }

  async process(job: Job): Promise<{ affected: number }> {
    const started = Date.now();
    const affected = await this.run(job);
    logJobCompleted(this.logger, job, Date.now() - started, { affected });
    return { affected };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    logJobFailure(this.logger, job, error);
  }

  private run(job: Job): Promise<number> {
    switch (job.name) {
      case JobName.CLEANUP_SESSIONS:
        return this.maintenance.cleanupSessions();
      case JobName.CLEANUP_TOKENS:
        return this.maintenance.cleanupTokens();
      case JobName.CLEANUP_NOTIFICATIONS:
        return this.maintenance.cleanupNotifications();
      case JobName.CLEANUP_PENDING_UPLOADS:
        return this.maintenance.cleanupPendingUploads();
      case JobName.CLEANUP_REPORTS:
        return this.maintenance.cleanupReports();
      case JobName.PURGE_TRASH:
        return this.maintenance.purgeTrash();
      case JobName.CLEANUP_AUDIT_LOGS:
        return this.maintenance.cleanupAuditLogs();
      case JobName.PURGE_STORAGE_PREFIX:
        return this.maintenance.purgePrefix((job.data as PurgeStoragePrefixJob).prefix);
      case JobName.DELETE_STORAGE_OBJECTS:
        return this.maintenance.deleteObjects((job.data as DeleteStorageObjectsJob).keys);
      default:
        throw new Error(`Unknown job "${job.name}" on ${QueueName.MAINTENANCE}`);
    }
  }
}
