import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { Errors } from '../../common/errors/api-exception.js';
import { AppConfig } from '../../config/app-config.js';
import { QueueService } from '../../infrastructure/queue/queue.service.js';
import { detectFileType } from '../../infrastructure/storage/file-type.js';
import { StorageKeys } from '../../infrastructure/storage/storage-keys.js';
import { StorageService } from '../../infrastructure/storage/storage.service.js';

import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import { toUserDto, type UserDto } from './dto/user.dto.js';
import { UsersRepository } from './users.repository.js';

export interface UploadedFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

/** Presigned avatar URLs live longer than the redirect's browser cache. */
const AVATAR_URL_TTL_SECONDS = 3_600;

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly config: AppConfig,
  ) {}

  async getProfile(userId: string): Promise<UserDto> {
    const user = await this.users.findById(userId);
    if (!user) throw Errors.notFound('User');
    return toUserDto(user);
  }

  async updateProfile(userId: string, input: UpdateProfileDto): Promise<UserDto> {
    const user = await this.users.update(userId, {
      name: input.name,
      ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
      ...(input.timezone ? { timezone: input.timezone } : {}),
    });
    return toUserDto(user);
  }

  /**
   * Avatars are validated by content (images only, no SVG), stored privately in
   * object storage and exposed through a stable, cache-friendly API URL that
   * redirects to a short-lived presigned URL.
   */
  async uploadAvatar(userId: string, file: UploadedFile | undefined): Promise<UserDto> {
    if (!file) throw Errors.field('avatar', 'A file is required');
    if (file.size > this.config.storage.maxAvatarBytes) {
      throw Errors.payloadTooLarge('The image is too large.');
    }
    const type = detectFileType(file.originalname, file.buffer, { imagesOnly: true });
    if (!type) throw Errors.unsupportedMediaType('Upload a PNG, JPEG, GIF or WebP image', 'avatar');

    const current = await this.users.findById(userId);
    if (!current) throw Errors.notFound('User');

    const key = StorageKeys.avatar(userId, type.extension);
    await this.storage.putObject(key, file.buffer, {
      contentType: type.mime,
      cacheControl: 'private, max-age=31536000, immutable',
    });
    const version = randomBytes(6).toString('base64url');
    const user = await this.users.update(userId, {
      avatarKey: key,
      avatarUrl: `${this.config.http.publicApiUrl}/users/${userId}/avatar?v=${version}`,
    });
    if (current.avatarKey) await this.queue.deleteStorageObjects([current.avatarKey]);
    return toUserDto(user);
  }

  async removeAvatar(userId: string): Promise<UserDto> {
    const current = await this.users.findById(userId);
    if (!current) throw Errors.notFound('User');
    const user = await this.users.update(userId, { avatarKey: null, avatarUrl: null });
    if (current.avatarKey) await this.queue.deleteStorageObjects([current.avatarKey]);
    return toUserDto(user);
  }

  /** Short-lived URL for a user's avatar image, or null if they have none. */
  async avatarDownloadUrl(userId: string): Promise<string | null> {
    const user = await this.users.findById(userId);
    if (!user?.avatarKey) return null;
    return this.storage.presignDownload(user.avatarKey, {
      fileName: `avatar-${userId}`,
      inline: true,
      expiresIn: AVATAR_URL_TTL_SECONDS,
    });
  }
}
