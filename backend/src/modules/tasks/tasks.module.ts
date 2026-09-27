import { Module } from '@nestjs/common';

import { LabelsModule } from '../labels/labels.module.js';

import { ChecklistService } from './checklist.service.js';
import { TasksController } from './tasks.controller.js';
import { TasksRepository } from './tasks.repository.js';
import { TasksService } from './tasks.service.js';

@Module({
  imports: [LabelsModule],
  controllers: [TasksController],
  providers: [TasksService, TasksRepository, ChecklistService],
  exports: [TasksService],
})
export class TasksModule {}
