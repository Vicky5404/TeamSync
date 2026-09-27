import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { CursorQueryDto } from '../../../common/dto/pagination.dto.js';
import { UserSummaryDto } from '../../../common/dto/user-summary.dto.js';

export class AuditLogQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ example: 'member.role_changed', description: 'Only this action' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  action?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only events by this user' })
  @IsOptional()
  @IsUUID()
  actorId?: string;
}

export class AuditLogDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'member.role_changed' })
  action: string;

  @ApiProperty({ example: 'member' })
  entityType: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  entityId: string | null;

  @ApiProperty({ type: UserSummaryDto, nullable: true, description: 'Null for system events' })
  actor: UserSummaryDto | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { from: 'MEMBER', to: 'MANAGER', name: 'Sofia Rodríguez' },
  })
  metadata: Record<string, string | number | boolean | null>;

  @ApiProperty({ type: String, nullable: true })
  ipAddress: string | null;

  @ApiProperty({ type: String, nullable: true })
  userAgent: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class AuditLogPageDto {
  @ApiProperty({ type: [AuditLogDto] })
  data: AuditLogDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null;
}
