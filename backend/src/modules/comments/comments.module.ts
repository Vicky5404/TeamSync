import { Module } from '@nestjs/common';

import { TasksModule } from '../tasks/tasks.module.js';

import { CommentsController } from './comments.controller.js';
import { CommentsRepository } from './comments.repository.js';
import { CommentsService } from './comments.service.js';

@Module({
  imports: [TasksModule],
  controllers: [CommentsController],
  providers: [CommentsService, CommentsRepository],
})
export class CommentsModule {}
