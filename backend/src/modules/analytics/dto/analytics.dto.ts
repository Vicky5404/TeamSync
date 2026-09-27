import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsUUID } from 'class-validator';

import { UserSummaryDto } from '../../../common/dto/user-summary.dto.js';
import {
  ProjectStatus,
  ReportStatus,
  ReportType,
  TaskPriority,
  TaskStatus,
} from '../../../generated/prisma/enums.js';

export const COMPLETION_RANGES = [7, 14, 30, 90] as const;
export type CompletionRange = (typeof COMPLETION_RANGES)[number];

export class RangeQueryDto {
  @ApiPropertyOptional({ enum: COMPLETION_RANGES, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(COMPLETION_RANGES)
  days?: CompletionRange;
}

export class DashboardSummaryDto {
  @ApiProperty() totalProjects: number;
  @ApiProperty() activeProjects: number;
  @ApiProperty() totalTasks: number;
  @ApiProperty() completedTasks: number;
  @ApiProperty() overdueTasks: number;
  @ApiProperty({ description: 'Open tasks assigned to the current user' }) assignedToMe: number;
  @ApiProperty({ description: 'Open tasks due within the next 7 days' }) dueThisWeek: number;
}

export class CompletionPointDto {
  @ApiProperty({ format: 'date' }) date: string;
  @ApiProperty() created: number;
  @ApiProperty() completed: number;
}

export class WorkloadEntryDto {
  @ApiProperty({ type: UserSummaryDto }) member: UserSummaryDto;
  @ApiProperty() todo: number;
  @ApiProperty() inProgress: number;
  @ApiProperty() review: number;
}

export class ProjectProgressEntryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() key: string;
  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus' }) status: ProjectStatus;
  @ApiProperty({ minimum: 0, maximum: 100 }) progress: number;
  @ApiProperty({ type: String, format: 'date', nullable: true }) dueDate: string | null;
  @ApiProperty() totalTasks: number;
  @ApiProperty() completedTasks: number;
}

export class StatusCountDto {
  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' }) status: TaskStatus;
  @ApiProperty() count: number;
}

export class PriorityCountDto {
  @ApiProperty({ enum: TaskPriority, enumName: 'TaskPriority' }) priority: TaskPriority;
  @ApiProperty() count: number;
}

export class TaskSummaryDto {
  @ApiProperty() total: number;
  @ApiProperty() completed: number;
  @ApiProperty() overdue: number;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Mean days from creation to completion',
  })
  averageCycleTimeDays: number | null;
}

export class ProjectAnalyticsDto {
  @ApiProperty({ type: [StatusCountDto] }) byStatus: StatusCountDto[];
  @ApiProperty({ type: [PriorityCountDto] }) byPriority: PriorityCountDto[];
  @ApiProperty({ type: [CompletionPointDto] }) completionTrend: CompletionPointDto[];
  @ApiProperty({ type: [WorkloadEntryDto] }) workload: WorkloadEntryDto[];
  @ApiProperty({ type: TaskSummaryDto }) summary: TaskSummaryDto;
}

export class TaskStatisticsDto extends TaskSummaryDto {
  @ApiProperty({ type: [StatusCountDto] }) byStatus: StatusCountDto[];
  @ApiProperty({ type: [PriorityCountDto] }) byPriority: PriorityCountDto[];
  @ApiProperty({ description: 'Completed / total, 0–100' }) completionRate: number;
  @ApiProperty() unassigned: number;
}

export class CompletionRateDto {
  @ApiProperty() days: number;
  @ApiProperty({ description: 'Tasks created in the window' }) created: number;
  @ApiProperty({ description: 'Tasks completed in the window' }) completed: number;
  @ApiProperty({ description: 'Completed / created in the window, 0–100 (capped)' })
  completionRate: number;
  @ApiProperty({ description: 'Tasks completed in the preceding window of the same length' })
  previousCompleted: number;
}

export class OverdueByProjectDto {
  @ApiProperty({ format: 'uuid' }) projectId: string;
  @ApiProperty() name: string;
  @ApiProperty() key: string;
  @ApiProperty() count: number;
}

export class OverdueByAssigneeDto {
  @ApiProperty({ type: UserSummaryDto, nullable: true, description: 'null = unassigned' })
  member: UserSummaryDto | null;
  @ApiProperty() count: number;
}

export class OverdueTaskDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() identifier: string;
  @ApiProperty() title: string;
  @ApiProperty({ format: 'uuid' }) projectId: string;
  @ApiProperty({ format: 'date' }) dueDate: string;
  @ApiProperty() daysOverdue: number;
  @ApiProperty({ enum: TaskPriority, enumName: 'TaskPriority' }) priority: TaskPriority;
  @ApiProperty({ type: UserSummaryDto, nullable: true }) assignee: UserSummaryDto | null;
}

export class OverdueReportDto {
  @ApiProperty() total: number;
  @ApiProperty({ type: [OverdueByProjectDto] }) byProject: OverdueByProjectDto[];
  @ApiProperty({ type: [OverdueByAssigneeDto] }) byAssignee: OverdueByAssigneeDto[];
  @ApiProperty({ type: [OverdueTaskDto], description: 'Most overdue first (max 20)' })
  mostOverdue: OverdueTaskDto[];
}

export class DailyCountDto {
  @ApiProperty({ format: 'date' }) date: string;
  @ApiProperty() count: number;
}

export class ActionCountDto {
  @ApiProperty() action: string;
  @ApiProperty() count: number;
}

export class ContributorDto {
  @ApiProperty({ type: UserSummaryDto }) member: UserSummaryDto;
  @ApiProperty() count: number;
}

export class ActivityMetricsDto {
  @ApiProperty() days: number;
  @ApiProperty() total: number;
  @ApiProperty({ type: [DailyCountDto] }) byDay: DailyCountDto[];
  @ApiProperty({ type: [ActionCountDto] }) byAction: ActionCountDto[];
  @ApiProperty({ type: [ContributorDto], description: 'Most active members (max 10)' })
  topContributors: ContributorDto[];
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export class CreateReportDto {
  @ApiProperty({ enum: ReportType, enumName: 'ReportType' })
  @IsEnum(ReportType)
  type: ReportType;

  @ApiPropertyOptional({ format: 'uuid', description: 'Limit a task export to one project' })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class ReportDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ReportType, enumName: 'ReportType' }) type: ReportType;
  @ApiProperty({ enum: ReportStatus, enumName: 'ReportStatus' }) status: ReportStatus;
  @ApiProperty({ type: String, nullable: true }) fileName: string | null;
  @ApiProperty({ type: String, nullable: true }) error: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Present once completed; short-lived' })
  downloadUrl: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) completedAt: string | null;
}
