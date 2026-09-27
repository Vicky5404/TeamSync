import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

import { trim } from '../../../common/utils/transforms.js';
import { LabelColor } from '../../../generated/prisma/enums.js';

export class LabelDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Bug' })
  name: string;

  @ApiProperty({ enum: LabelColor, enumName: 'LabelColor' })
  color: LabelColor;
}

export class CreateLabelDto {
  @ApiProperty({ minLength: 1, maxLength: 32 })
  @Transform(trim)
  @IsString()
  @Length(1, 32)
  name: string;

  @ApiProperty({ enum: LabelColor, enumName: 'LabelColor' })
  @IsEnum(LabelColor)
  color: LabelColor;
}

export class UpdateLabelDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 32 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 32)
  name?: string;

  @ApiPropertyOptional({ enum: LabelColor, enumName: 'LabelColor' })
  @IsOptional()
  @IsEnum(LabelColor)
  color?: LabelColor;
}
