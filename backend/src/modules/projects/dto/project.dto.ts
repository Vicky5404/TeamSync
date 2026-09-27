import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { PageMetaDto, PageQueryDto } from '../../../common/dto/pagination.dto.js';
import { UserSummaryDto } from '../../../common/dto/user-summary.dto.js';
import {
  optionalQueryString,
  queryArray,
  trim,
  trimToNull,
} from '../../../common/utils/transforms.js';
import { IsCalendarDate } from '../../../common/validation/is-calendar-date.js';
import { ProjectStatus } from '../../../generated/prisma/enums.js';

export const PROJECT_SORTS = ['updated', 'name', 'dueDate', 'progress', 'created'] as const;
export type ProjectSort = (typeof PROJECT_SORTS)[number];

export class ProjectListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: 'Matches name, key or description' })
  @IsOptional()
  @Transform(optionalQueryString)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ProjectStatus, enumName: 'ProjectStatus', isArray: true })
  @IsOptional()
  @Transform(queryArray)
  @IsEnum(ProjectStatus, { each: true })
  status?: ProjectStatus[];

  @ApiPropertyOptional({ enum: PROJECT_SORTS, default: 'updated' })
  @IsOptional()
  @Transform(optionalQueryString)
  @IsIn(PROJECT_SORTS)
  sort?: ProjectSort;
}

export class CreateProjectDto {
  @ApiProperty({ minLength: 2, maxLength: 80, example: 'Website redesign' })
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiProperty({
    example: 'WEB',
    description: '2–6 uppercase letters or digits, starting with a letter',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z][A-Z0-9]{1,5}$/, { message: 'Use 2–6 letters or numbers' })
  key: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 2000 })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({
    enum: ProjectStatus,
    enumName: 'ProjectStatus',
    default: ProjectStatus.PLANNING,
  })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsCalendarDate()
  startDate?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsCalendarDate()
  dueDate?: string | null;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Organization members to add',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  memberIds?: string[];
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class AddProjectMemberDto {
  @ApiProperty({ format: 'uuid', description: 'User id of an organization member' })
  @IsUUID()
  userId: string;
}

export class ProjectTaskCountsDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  completed: number;

  @ApiProperty()
  overdue: number;
}

export class ProjectDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  organizationId: string;

  @ApiProperty({ example: 'WEB' })
  key: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus' })
  status: ProjectStatus;

  @ApiProperty({
    minimum: 0,
    maximum: 100,
    description: 'Completion percentage computed from tasks',
  })
  progress: number;

  @ApiProperty({ type: [UserSummaryDto] })
  members: UserSummaryDto[];

  @ApiProperty({ type: ProjectTaskCountsDto })
  taskCounts: ProjectTaskCountsDto;

  @ApiProperty({ type: UserSummaryDto })
  owner: UserSummaryDto;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  startDate: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  dueDate: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class PaginatedProjectsDto {
  @ApiProperty({ type: [ProjectDto] })
  data: ProjectDto[];

  @ApiProperty({ type: PageMetaDto })
  meta: PageMetaDto;
}
