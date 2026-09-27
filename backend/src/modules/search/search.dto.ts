import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { optionalQueryString } from '../../common/utils/transforms.js';
import { ProjectStatus, TaskStatus } from '../../generated/prisma/enums.js';

export class SearchQueryDto {
  @ApiPropertyOptional({
    description: 'At least 2 characters; shorter queries return empty results',
  })
  @IsOptional()
  @Transform(optionalQueryString)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class SearchProjectResultDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() key: string;
  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus' }) status: ProjectStatus;
}

export class SearchTaskResultDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'WEB-42' }) identifier: string;
  @ApiProperty() title: string;
  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' }) status: TaskStatus;
  @ApiProperty({ format: 'uuid' }) projectId: string;
  @ApiProperty() projectName: string;
}

export class SearchMemberResultDto {
  @ApiProperty({ format: 'uuid', description: 'Membership id' }) id: string;
  @ApiProperty({ format: 'uuid' }) userId: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ type: String, nullable: true }) avatarUrl: string | null;
}

export class SearchResultsDto {
  @ApiProperty({ type: [SearchProjectResultDto] }) projects: SearchProjectResultDto[];
  @ApiProperty({ type: [SearchTaskResultDto] }) tasks: SearchTaskResultDto[];
  @ApiProperty({ type: [SearchMemberResultDto] }) members: SearchMemberResultDto[];
}
