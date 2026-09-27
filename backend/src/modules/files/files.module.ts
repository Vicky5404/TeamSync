import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';

import { AppConfig } from '../../config/app-config.js';
import { TasksModule } from '../tasks/tasks.module.js';

import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';

@Module({
  imports: [
    TasksModule,
    // In-memory multipart parsing bounded by the upload limit; larger files use presigned uploads.
    MulterModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        limits: { fileSize: config.storage.maxUploadBytes, files: 1, fields: 5, parts: 6 },
      }),
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
