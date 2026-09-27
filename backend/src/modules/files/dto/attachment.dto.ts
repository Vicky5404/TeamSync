import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, MaxLength, Min } from 'class-validator';

import { UserSummaryDto } from '../../../common/dto/user-summary.dto.js';
import { trim } from '../../../common/utils/transforms.js';

export class AttachmentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  taskId: string;

  @ApiProperty({ example: 'spec.pdf' })
  fileName: string;

  @ApiProperty({ example: 'application/pdf', description: 'Verified from the file contents' })
  mimeType: string;

  @ApiProperty({ description: 'Size in bytes' })
  size: number;

  @ApiProperty({ description: 'Short-lived download URL (forces download)' })
  url: string;

  @ApiProperty({ type: UserSummaryDto })
  uploadedBy: UserSummaryDto;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class CreateUploadUrlDto {
  @ApiProperty({ example: 'design.png', maxLength: 255 })
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  fileName: string;

  @ApiProperty({ description: 'Exact size in bytes (signed into the upload URL)' })
  @IsInt()
  @Min(1)
  size: number;

  @ApiPropertyOptional({
    description: 'Ignored; the type is derived from the extension and verified after upload',
  })
  @IsOptional()
  @IsString()
  @MaxLength(127)
  mimeType?: string;
}

export class UploadUrlDto {
  @ApiProperty({ format: 'uuid' })
  attachmentId: string;

  @ApiProperty({ description: 'Presigned URL — upload the bytes with an HTTP PUT' })
  uploadUrl: string;

  @ApiProperty({ example: 'PUT' })
  method: 'PUT';

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Headers the PUT must send',
  })
  headers: Record<string, string>;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;
}

export class DownloadUrlDto {
  @ApiProperty()
  url: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;
}
