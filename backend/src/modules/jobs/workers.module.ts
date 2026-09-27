import { Module } from '@nestjs/common';

import { MailService } from '../../infrastructure/mail/mail.service.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';

import { EmailProcessor } from './email.processor.js';
import { JobSchedulerService } from './job-scheduler.service.js';
import { MaintenanceProcessor } from './maintenance.processor.js';
import { MaintenanceService } from './maintenance.service.js';
import { NotificationsProcessor } from './notifications.processor.js';
import { ReportsProcessor } from './reports.processor.js';

/**
 * BullMQ processors. Loaded by the dedicated worker process (`npm run
 * start:worker`), or inside the API when `RUN_WORKERS_IN_API=true`.
 */
@Module({
  imports: [AnalyticsModule],
  providers: [
    MailService,
    MaintenanceService,
    NotificationsProcessor,
    EmailProcessor,
    ReportsProcessor,
    MaintenanceProcessor,
    JobSchedulerService,
  ],
})
export class WorkersModule {}
