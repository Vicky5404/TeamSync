import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

import { UserSummaryDto } from '../../../common/dto/user-summary.dto.js';
import { optionalQueryString, trim, trimToNull } from '../../../common/utils/transforms.js';
import { ProjectStatus, Role } from '../../../generated/prisma/enums.js';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MESSAGE = 'Use lowercase letters, numbers and single hyphens';

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export class CreateOrganizationDto {
  @ApiProperty({ minLength: 2, maxLength: 64, example: 'Acme Inc.' })
  @Transform(trim)
  @IsString()
  @Length(2, 64)
  name: string;

  @ApiProperty({ minLength: 2, maxLength: 48, example: 'acme', pattern: SLUG_PATTERN.source })
  @Transform(trim)
  @IsString()
  @Length(2, 48)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug: string;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 64 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 64)
  name?: string;

  @ApiPropertyOptional({ minLength: 2, maxLength: 48, pattern: SLUG_PATTERN.source })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 48)
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  slug?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class OrganizationDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ type: String, nullable: true })
  logoUrl: string | null;

  @ApiProperty()
  memberCount: number;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ enum: Role, enumName: 'Role', description: 'The authenticated user’s role' })
  role: Role;
}

export class TransferOwnershipDto {
  @ApiProperty({ format: 'uuid', description: 'Membership id of the new owner' })
  @IsUUID()
  memberId: string;
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export class MemberListQueryDto {
  @ApiPropertyOptional({ description: 'Matches name or email' })
  @IsOptional()
  @Transform(optionalQueryString)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: Role, enumName: 'Role' })
  @IsOptional()
  @Transform(optionalQueryString)
  @IsEnum(Role)
  role?: Role;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: Role, enumName: 'Role' })
  @IsEnum(Role, { message: 'Choose a valid role' })
  role: Role;
}

export class MemberUserDto extends UserSummaryDto {
  @ApiProperty({ type: String, nullable: true })
  jobTitle: string | null;

  @ApiProperty({ example: 'Europe/London' })
  timezone: string;
}

export class MemberDto {
  @ApiProperty({ format: 'uuid', description: 'Membership id (not the user id)' })
  id: string;

  @ApiProperty({ type: MemberUserDto })
  user: MemberUserDto;

  @ApiProperty({ enum: Role, enumName: 'Role' })
  role: Role;

  @ApiProperty({ format: 'date-time' })
  joinedAt: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastActiveAt: string | null;
}

export class MemberStatsDto {
  @ApiProperty()
  openTasks: number;

  @ApiProperty()
  completedTasks: number;

  @ApiProperty()
  overdueTasks: number;

  @ApiProperty()
  projects: number;
}

export class MemberProjectSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  key: string;

  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus' })
  status: ProjectStatus;

  @ApiProperty({ minimum: 0, maximum: 100 })
  progress: number;
}

export class MemberProfileDto extends MemberDto {
  @ApiProperty({ type: MemberStatsDto })
  stats: MemberStatsDto;

  @ApiProperty({ type: [MemberProjectSummaryDto] })
  projects: MemberProjectSummaryDto[];
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export class InviteMembersDto {
  @ApiProperty({ type: [String], example: ['sam@example.com'], maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1, { message: 'Enter at least one email address' })
  @ArrayMaxSize(50)
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? (value as unknown[]).map((email) =>
          typeof email === 'string' ? email.trim().toLowerCase() : email,
        )
      : value,
  )
  @IsEmail({}, { each: true, message: 'Enter valid email addresses' })
  emails: string[];

  @ApiProperty({ enum: Role, enumName: 'Role' })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(500)
  message?: string | null;
}

export class AcceptInvitationDto {
  @ApiProperty()
  @IsString()
  @Length(16, 256)
  token: string;
}

export class InvitationDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: Role, enumName: 'Role' })
  role: Role;

  @ApiProperty({ enum: ['PENDING', 'EXPIRED'] })
  status: 'PENDING' | 'EXPIRED';

  @ApiProperty({ type: UserSummaryDto })
  invitedBy: UserSummaryDto;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;
}

export class SkippedInvitationDto {
  @ApiProperty()
  email: string;

  @ApiProperty({ example: 'already a member' })
  reason: string;
}

export class InviteMembersResultDto {
  @ApiProperty({ type: [InvitationDto] })
  invited: InvitationDto[];

  @ApiProperty({ type: [SkippedInvitationDto] })
  skipped: SkippedInvitationDto[];
}
