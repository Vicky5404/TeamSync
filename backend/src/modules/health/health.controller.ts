import { Controller, Get, Header, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { Public } from '../../common/auth/decorators.js';

import { type HealthReport, HealthService } from './health.service.js';

/** Served outside the API prefix: `GET /health` (readiness) and `GET /health/live` (liveness). */
@ApiTags('Health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Readiness: API, PostgreSQL and Redis' })
  @ApiOkResponse({ description: 'All dependencies are up' })
  @ApiServiceUnavailableResponse({ description: 'At least one dependency is down' })
  async check(@Res({ passthrough: true }) response: Response): Promise<HealthReport> {
    const report = await this.health.check();
    if (report.status !== 'ok') response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return report;
  }

  @Get('live')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Liveness: the process is running (no dependency checks)' })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
