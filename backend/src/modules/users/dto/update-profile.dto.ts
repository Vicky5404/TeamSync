import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsTimeZone, Length, MaxLength } from 'class-validator';

import { trim, trimToNull } from '../../../common/utils/transforms.js';

export class UpdateProfileDto {
  @ApiProperty({ minLength: 2, maxLength: 80, example: 'Alex Morgan' })
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 100, example: 'Product Lead' })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(100)
  jobTitle?: string | null;

  @ApiPropertyOptional({ example: 'Europe/London', description: 'IANA time zone' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
