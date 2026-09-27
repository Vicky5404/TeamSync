import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { normalizeEmail, trim } from '../../../common/utils/transforms.js';
import { UserDto } from '../../users/dto/user.dto.js';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export class RegisterDto {
  @ApiProperty({ minLength: 2, maxLength: 80, example: 'Alex Morgan' })
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiProperty({ example: 'alex@example.com' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX, format: 'password' })
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX, {
    message: `Password must be ${PASSWORD_MIN}–${PASSWORD_MAX} characters`,
  })
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'alex@example.com' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ format: 'password' })
  @IsString()
  @Length(1, PASSWORD_MAX)
  password: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Keep the session for 30 days instead of the browser session',
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class EmailDto {
  @ApiProperty({ example: 'alex@example.com' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email: string;
}

export class TokenDto {
  @ApiProperty({ description: 'Token from the emailed link' })
  @IsString()
  @Length(16, 256)
  token: string;
}

export class DeleteAccountDto {
  @ApiProperty({ format: 'password', description: 'Current password, to confirm' })
  @IsString()
  @Length(1, PASSWORD_MAX)
  password: string;
}

export class ResetPasswordDto extends TokenDto {
  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX, format: 'password' })
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX, {
    message: `Password must be ${PASSWORD_MIN}–${PASSWORD_MAX} characters`,
  })
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  @Length(1, PASSWORD_MAX)
  currentPassword: string;

  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX, format: 'password' })
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX, {
    message: `Password must be ${PASSWORD_MIN}–${PASSWORD_MAX} characters`,
  })
  newPassword: string;
}

export class RevokeSessionsQueryDto {
  @ApiPropertyOptional({
    enum: ['others'],
    description: 'Only `others` is supported: revoke every session except the current one',
  })
  @IsOptional()
  @IsString()
  scope?: string;
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export class AuthSessionDto {
  @ApiProperty({ description: 'Short-lived JWT; send as `Authorization: Bearer <token>`' })
  accessToken: string;

  @ApiProperty({ description: 'Access-token lifetime in seconds', example: 900 })
  expiresIn: number;

  @ApiProperty({ type: UserDto })
  user: UserDto;
}

export class RegisterResultDto {
  @ApiProperty()
  email: string;

  @ApiProperty()
  requiresEmailVerification: boolean;
}

export class UserSessionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Desktop' })
  device: string;

  @ApiProperty({ example: 'Chrome' })
  browser: string;

  @ApiProperty({ example: 'Windows' })
  os: string;

  @ApiProperty({ example: '203.0.113.7' })
  ipAddress: string;

  @ApiProperty({ type: String, nullable: true })
  location: string | null;

  @ApiProperty({ format: 'date-time' })
  lastActiveAt: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ description: 'Whether this is the session making the request' })
  current: boolean;
}
