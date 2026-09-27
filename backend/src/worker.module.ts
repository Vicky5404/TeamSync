import { Module } from '@nestjs/common';

import { CORE_IMPORTS } from './app.module.js';
import { HealthService } from './modules/health/health.service.js';
import { WorkersModule } from './modules/jobs/workers.module.js';

/** Background worker process: queue processors and schedulers, no HTTP API. */
@Module({
  imports: [...CORE_IMPORTS, WorkersModule],
  // Backs the worker's minimal health endpoint (see worker.ts).
  providers: [HealthService],
})
export class WorkerModule {}
