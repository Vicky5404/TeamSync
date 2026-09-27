import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, ValidateNested } from 'class-validator';

import { CursorQueryDto } from '../../../common/dto/pagination.dto.js';
import { UserSummaryDto } from '../../../common/dto/user-summary.dto.js';
import { NotificationType } from '../../../generated/prisma/enums.js';

export const EMAIL_DIGESTS = ['never', 'daily', 'weekly'] as const;
export type EmailDigest = (typeof EMAIL_DIGESTS)[number];

export class NotificationListQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: ['all', 'unread'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'unread'])
  filter?: 'all' | 'unread';
}

export class NotificationResourceDto {
  @ApiProperty({ enum: ['task', 'project', 'organization'] })
  type: 'task' | 'project' | 'organization';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ format: 'uuid' })
  projectId?: string;
}

export class NotificationDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  type: NotificationType;

  @ApiProperty()
  title: string;

  @ApiProperty({ type: String, nullable: true })
  body: string | null;

  @ApiProperty({ type: UserSummaryDto, nullable: true })
  actor: UserSummaryDto | null;

  @ApiProperty({ type: NotificationResourceDto, nullable: true })
  resource: NotificationResourceDto | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readAt: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class NotificationPageDto {
  @ApiProperty({ type: [NotificationDto] })
  data: NotificationDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null;
}

export class UnreadCountDto {
  @ApiProperty({ example: 3 })
  count: number;
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export class ChannelPreferenceDto {
  @ApiProperty()
  @IsBoolean()
  inApp: boolean;

  @ApiProperty()
  @IsBoolean()
  email: boolean;
}

/** One entry per notification type (all required). */
export class NotificationChannelsDto implements Record<NotificationType, ChannelPreferenceDto> {
  @ApiProperty({ type: ChannelPreferenceDto })
  @ValidateNested()
  @Type(() => ChannelPreferenceDto)
  TASK_ASSIGNED: ChannelPreferenceDto;

  @ApiProperty({ type: ChannelPreferenceDto })
  @ValidateNested()
  @Type(() => ChannelPreferenceDto)
  TASK_COMMENTED: ChannelPreferenceDto;

  @ApiProperty({ type: ChannelPreferenceDto })
  @ValidateNested()
  @Type(() => ChannelPreferenceDto)
  MENTIONED: ChannelPreferenceDto;

  @ApiProperty({ type: ChannelPreferenceDto })
  @ValidateNested()
  @Type(() => ChannelPreferenceDto)
  TASK_DUE_SOON: ChannelPreferenceDto;

  @ApiProperty({ type: ChannelPreferenceDto })
  @ValidateNested()
  @Type(() => ChannelPreferenceDto)
  TASK_STATUS_CHANGED: ChannelPreferenceDto;

  @ApiProperty({ type: ChannelPreferenceDto })
  @ValidateNested()
  @Type(() => ChannelPreferenceDto)
  PROJECT_ADDED: ChannelPreferenceDto;

  @ApiProperty({ type: ChannelPreferenceDto })
  @ValidateNested()
  @Type(() => ChannelPreferenceDto)
  MEMBER_JOINED: ChannelPreferenceDto;
}

export class NotificationPreferencesDto {
  @ApiProperty({ type: NotificationChannelsDto })
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  channels: NotificationChannelsDto;

  @ApiProperty({ enum: EMAIL_DIGESTS })
  @IsIn(EMAIL_DIGESTS)
  emailDigest: EmailDigest;
}
