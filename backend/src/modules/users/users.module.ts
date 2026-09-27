import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';

import { AppConfig } from '../../config/app-config.js';

import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [
    // In-memory uploads (no temp files); bounded by the avatar size limit.
    MulterModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        limits: { fileSize: config.storage.maxAvatarBytes, files: 1, fields: 5, parts: 6 },
      }),
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
