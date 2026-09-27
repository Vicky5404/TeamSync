import { ApiProperty } from '@nestjs/swagger';

import type { User } from '../../../generated/prisma/client.js';

export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'alex@example.com' })
  email: string;

  @ApiProperty({ example: 'Alex Morgan' })
  name: string;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Product Lead' })
  jobTitle: string | null;

  @ApiProperty({ example: 'Europe/London' })
  timezone: string;

  @ApiProperty()
  emailVerified: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

/** Never expose password hashes, avatar storage keys or other internals. */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    jobTitle: user.jobTitle,
    timezone: user.timezone,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt.toISOString(),
  };
}
