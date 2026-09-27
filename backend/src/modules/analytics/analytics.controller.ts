import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AccessContext } from '../../common/auth/auth.types.js';
import { Access, RequirePermission } from '../../common/auth/decorators.js';
import { uuidParam } from '../../common/pipes/uuid-param.pipe.js';

import { AnalyticsService } from './analytics.service.js';
import {
  ActivityMetricsDto,
  CompletionPointDto,
  CompletionRateDto,
  CreateReportDto,
  DashboardSummaryDto,
  OverdueReportDto,
  ProjectAnalyticsDto,
  ProjectProgressEntryDto,
  RangeQueryDto,
  ReportDto,
  TaskStatisticsDto,
  WorkloadEntryDto,
} from './dto/analytics.dto.js';
import { ReportsService } from './reports.service.js';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller()
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly reports: ReportsService,
  ) {}

  @Get('organizations/:organizationId/analytics/dashboard')
  @ApiOperation({ summary: 'Dashboard summary counts' })
  @ApiOkResponse({ type: DashboardSummaryDto })
  dashboard(@Access() access: AccessContext): Promise<DashboardSummaryDto> {
    return this.analytics.dashboard(access);
  }

  @Get('organizations/:organizationId/analytics/task-completion')
  @ApiOperation({ summary: 'Tasks created vs. completed per day' })
  @ApiOkResponse({ type: [CompletionPointDto] })
  taskCompletion(
    @Access() access: AccessContext,
    @Query() query: RangeQueryDto,
  ): Promise<CompletionPointDto[]> {
    return this.analytics.taskCompletion(access.organizationId, query.days);
  }

  @Get('organizations/:organizationId/analytics/workload')
  @ApiOperation({ summary: 'Open tasks per member by status (team workload)' })
  @ApiOkResponse({ type: [WorkloadEntryDto] })
  workload(@Access() access: AccessContext): Promise<WorkloadEntryDto[]> {
    return this.analytics.workload(access.organizationId);
  }

  @Get('organizations/:organizationId/analytics/project-progress')
  @ApiOperation({ summary: 'Progress of every non-archived project' })
  @ApiOkResponse({ type: [ProjectProgressEntryDto] })
  projectProgress(@Access() access: AccessContext): Promise<ProjectProgressEntryDto[]> {
    return this.analytics.projectProgress(access.organizationId);
  }

  @Get('organizations/:organizationId/analytics/tasks')
  @ApiOperation({
    summary: 'Task statistics: status/priority breakdown, completion rate, overdue, cycle time',
  })
  @ApiOkResponse({ type: TaskStatisticsDto })
  taskStatistics(@Access() access: AccessContext): Promise<TaskStatisticsDto> {
    return this.analytics.taskStatistics(access.organizationId);
  }

  @Get('organizations/:organizationId/analytics/completion-rate')
  @ApiOperation({ summary: 'Completion rate over a window, compared with the previous window' })
  @ApiOkResponse({ type: CompletionRateDto })
  completionRate(
    @Access() access: AccessContext,
    @Query() query: RangeQueryDto,
  ): Promise<CompletionRateDto> {
    return this.analytics.completionRate(access.organizationId, query.days);
  }

  @Get('organizations/:organizationId/analytics/overdue')
  @ApiOperation({ summary: 'Overdue tasks by project and assignee, plus the most overdue tasks' })
  @ApiOkResponse({ type: OverdueReportDto })
  overdue(@Access() access: AccessContext): Promise<OverdueReportDto> {
    return this.analytics.overdue(access.organizationId);
  }

  @Get('organizations/:organizationId/analytics/activity')
  @ApiOperation({ summary: 'Activity metrics: events per day, by action, top contributors' })
  @ApiOkResponse({ type: ActivityMetricsDto })
  activity(
    @Access() access: AccessContext,
    @Query() query: RangeQueryDto,
  ): Promise<ActivityMetricsDto> {
    return this.analytics.activityMetrics(access.organizationId, query.days);
  }

  @Get('projects/:projectId/analytics')
  @ApiOperation({ summary: 'Project statistics' })
  @ApiOkResponse({ type: ProjectAnalyticsDto })
  project(@Access() access: AccessContext): Promise<ProjectAnalyticsDto> {
    return this.analytics.project(access);
  }

  // Reports ---------------------------------------------------------------------

  @Post('organizations/:organizationId/analytics/reports')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('reports:create')
  @ApiOperation({ summary: 'Request a CSV report (generated in the background)' })
  @ApiAcceptedResponse({ type: ReportDto })
  createReport(
    @Access() access: AccessContext,
    @Body() input: CreateReportDto,
  ): Promise<ReportDto> {
    return this.reports.create(access, input);
  }

  @Get('organizations/:organizationId/analytics/reports')
  @RequirePermission('reports:create')
  @ApiOperation({ summary: 'Recent reports' })
  @ApiOkResponse({ type: [ReportDto] })
  listReports(@Access() access: AccessContext): Promise<ReportDto[]> {
    return this.reports.list(access.organizationId);
  }

  @Get('organizations/:organizationId/analytics/reports/:reportId')
  @RequirePermission('reports:create')
  @ApiOperation({ summary: 'Report status and download URL' })
  @ApiOkResponse({ type: ReportDto })
  getReport(
    @Access() access: AccessContext,
    @Param('reportId', uuidParam('Report')) reportId: string,
  ): Promise<ReportDto> {
    return this.reports.get(access.organizationId, reportId);
  }
}
