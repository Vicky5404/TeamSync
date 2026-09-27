import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

import { CursorQueryDto } from '../../../common/dto/pagination.dto.js';
import { UserSummaryDto } from '../../../common/dto/user-summary.dto.js';

export class ActivityQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Only activity by this user' })
  @IsOptional()
  @IsUUID()
  actorId?: string;
}

export class ActivityTargetDto {
  @ApiProperty({ enum: ['task', 'project', 'member', 'organization'] })
  type: 'task' | 'project' | 'member' | 'organization';

  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ format: 'uuid' })
  projectId?: string;

  @ApiPropertyOptional({ example: 'WEB-42' })
  identifier?: string;
}

export class ActivityDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'task.status_changed' })
  action: string;

  @ApiProperty({ type: UserSummaryDto })
  actor: UserSummaryDto;

  @ApiProperty({ type: ActivityTargetDto })
  target: ActivityTargetDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string', nullable: true },
    example: { from: 'TODO', to: 'DONE' },
  })
  metadata: Record<string, string | null>;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class ActivityPageDto {
  @ApiProperty({ type: [ActivityDto] })
  data: ActivityDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null;
}
