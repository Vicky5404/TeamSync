import { Module } from '@nestjs/common';

import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsRepository } from './analytics.repository.js';
import { AnalyticsService } from './analytics.service.js';
import { ReportGeneratorService } from './report-generator.service.js';
import { ReportsService } from './reports.service.js';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRepository, ReportsService, ReportGeneratorService],
  exports: [ReportGeneratorService],
})
export class AnalyticsModule {}
