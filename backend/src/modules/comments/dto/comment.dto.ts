import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, Length } from 'class-validator';

import { UserSummaryDto } from '../../../common/dto/user-summary.dto.js';
import { trim } from '../../../common/utils/transforms.js';

export const COMMENT_MAX_LENGTH = 5000;

export class CreateCommentDto {
  @ApiProperty({
    minLength: 1,
    maxLength: COMMENT_MAX_LENGTH,
    description: 'Plain text. `@email@example.com` mentions organization members.',
  })
  @Transform(trim)
  @IsString()
  @Length(1, COMMENT_MAX_LENGTH, { message: 'Comment is required (max 5000 characters)' })
  body: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Explicit mentions (user ids)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  mentionedUserIds?: string[];
}

export class UpdateCommentDto extends CreateCommentDto {}

export class CommentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  taskId: string;

  @ApiProperty({ type: UserSummaryDto })
  author: UserSummaryDto;

  @ApiProperty()
  body: string;

  @ApiProperty({ type: [UserSummaryDto] })
  mentions: UserSummaryDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiProperty()
  edited: boolean;
}
