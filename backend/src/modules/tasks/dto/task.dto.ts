import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { MAX_PAGE_SIZE, PageMetaDto } from '../../../common/dto/pagination.dto.js';
import { UserSummaryDto } from '../../../common/dto/user-summary.dto.js';
import {
  optionalQueryString,
  queryArray,
  trim,
  trimToNull,
} from '../../../common/utils/transforms.js';
import { IsCalendarDate } from '../../../common/validation/is-calendar-date.js';
import { TaskPriority, TaskStatus } from '../../../generated/prisma/enums.js';
import { LabelDto } from '../../labels/dto/label.dto.js';

export const DUE_PRESETS = ['overdue', 'today', 'this_week', 'next_7_days', 'no_date'] as const;
export type DuePreset = (typeof DUE_PRESETS)[number];

export const TASK_SORT_FIELDS = [
  'title',
  'status',
  'priority',
  'dueDate',
  'createdAt',
  'updatedAt',
] as const;
export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

const ASSIGNEE_FILTER =
  /^(me|unassigned|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Filters shared by project boards and the organization-wide task list. */
export class TaskFiltersDto {
  @ApiPropertyOptional({ description: 'Matches title, description or identifier (e.g. `WEB-42`)' })
  @IsOptional()
  @Transform(optionalQueryString)
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: TaskStatus, enumName: 'TaskStatus', isArray: true })
  @IsOptional()
  @Transform(queryArray)
  @IsEnum(TaskStatus, { each: true })
  status?: TaskStatus[];

  @ApiPropertyOptional({ enum: TaskPriority, enumName: 'TaskPriority', isArray: true })
  @IsOptional()
  @Transform(queryArray)
  @IsEnum(TaskPriority, { each: true })
  priority?: TaskPriority[];

  @ApiPropertyOptional({
    type: [String],
    description: 'User ids; also accepts `me` and `unassigned`',
  })
  @IsOptional()
  @Transform(queryArray)
  @ArrayMaxSize(50)
  @Matches(ASSIGNEE_FILTER, {
    each: true,
    message: 'assignee must be a user id, "me" or "unassigned"',
  })
  assignee?: string[];

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Tasks having any of these labels',
  })
  @IsOptional()
  @Transform(queryArray)
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  labels?: string[];

  @ApiPropertyOptional({ enum: DUE_PRESETS })
  @IsOptional()
  @Transform(optionalQueryString)
  @IsIn(DUE_PRESETS)
  due?: DuePreset;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Transform(optionalQueryString)
  @IsCalendarDate()
  dueFrom?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Transform(optionalQueryString)
  @IsCalendarDate()
  dueTo?: string;
}

export class OrganizationTaskQueryDto extends TaskFiltersDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Transform(optionalQueryString)
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ enum: TASK_SORT_FIELDS, default: 'updatedAt' })
  @IsOptional()
  @Transform(optionalQueryString)
  @IsIn(TASK_SORT_FIELDS)
  sort?: TaskSortField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @Transform(optionalQueryString)
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export class CreateTaskDto {
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @Transform(trim)
  @IsString()
  @Length(1, 200, { message: 'Title is required (max 200 characters)' })
  title: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 50_000 })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(50_000)
  description?: string | null;

  @ApiPropertyOptional({ enum: TaskStatus, enumName: 'TaskStatus', default: TaskStatus.TODO })
  @IsOptional()
  @IsEnum(TaskStatus, { message: 'Choose a valid status' })
  status?: TaskStatus;

  @ApiPropertyOptional({
    enum: TaskPriority,
    enumName: 'TaskPriority',
    default: TaskPriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(TaskPriority, { message: 'Choose a valid priority' })
  priority?: TaskPriority;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @IsCalendarDate()
  dueDate?: string | null;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  labelIds?: string[];
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}

export class MoveTaskDto {
  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  @IsEnum(TaskStatus)
  status: TaskStatus;

  @ApiProperty({
    description: 'Fractional position between the new neighbours (ascending)',
    example: 1536,
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  position: number;
}

export class AssignTaskDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: '`null` unassigns' })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assigneeId: string | null;
}

export class ChangeStatusDto {
  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  @IsEnum(TaskStatus)
  status: TaskStatus;
}

export class ChangePriorityDto {
  @ApiProperty({ enum: TaskPriority, enumName: 'TaskPriority' })
  @IsEnum(TaskPriority)
  priority: TaskPriority;
}

export class SetDueDateDto {
  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    description: '`null` clears the due date',
  })
  @ValidateIf((_, value) => value !== null)
  @IsCalendarDate()
  dueDate: string | null;
}

export class AddLabelsDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  labelIds: string[];
}

export class CreateChecklistItemDto {
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  title: string;
}

export class UpdateChecklistItemDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 200 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export class TaskProjectRefDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'WEB' })
  key: string;

  @ApiProperty()
  name: string;
}

export class ChecklistSummaryDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  completed: number;
}

export class ChecklistItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  completed: boolean;

  @ApiProperty()
  position: number;
}

export class TaskDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'WEB-42' })
  identifier: string;

  @ApiProperty({ type: TaskProjectRefDto })
  project: TaskProjectRefDto;

  @ApiProperty()
  title: string;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  status: TaskStatus;

  @ApiProperty({ enum: TaskPriority, enumName: 'TaskPriority' })
  priority: TaskPriority;

  @ApiProperty({ description: 'Fractional ordering key within the status column (ascending)' })
  position: number;

  @ApiProperty({ type: UserSummaryDto, nullable: true })
  assignee: UserSummaryDto | null;

  @ApiProperty({ type: UserSummaryDto })
  reporter: UserSummaryDto;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  dueDate: string | null;

  @ApiProperty({ type: [LabelDto] })
  labels: LabelDto[];

  @ApiProperty()
  commentCount: number;

  @ApiProperty()
  attachmentCount: number;

  @ApiProperty({ type: ChecklistSummaryDto })
  checklist: ChecklistSummaryDto;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completedAt: string | null;
}

export class TaskDetailDto extends TaskDto {
  @ApiProperty({ type: [ChecklistItemDto] })
  checklistItems: ChecklistItemDto[];
}

export class PaginatedTasksDto {
  @ApiProperty({ type: [TaskDto] })
  data: TaskDto[];

  @ApiProperty({ type: PageMetaDto })
  meta: PageMetaDto;
}
