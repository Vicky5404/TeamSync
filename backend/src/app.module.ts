import { Module } from '@nestjs/common';
import { ConditionalModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Redis } from 'ioredis';

import { AccessGuard } from './common/authorization/access.guard.js';
import { AccessModule } from './common/authorization/access.module.js';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard.js';
import { LogContextInterceptor } from './common/interceptors/log-context.interceptor.js';
import { AppConfig } from './config/app-config.js';
import { AppConfigModule } from './config/app-config.module.js';
import { LoggerModule } from './infrastructure/logger/logger.module.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { QueueModule } from './infrastructure/queue/queue.module.js';
import { REDIS_CLIENT } from './infrastructure/redis/redis.constants.js';
import { RedisModule } from './infrastructure/redis/redis.module.js';
import { RedisThrottlerStorage } from './infrastructure/redis/redis-throttler.storage.js';
import { StorageModule } from './infrastructure/storage/storage.module.js';
import { ActivityModule } from './modules/activity/activity.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard.js';
import { CommentsModule } from './modules/comments/comments.module.js';
import { FilesModule } from './modules/files/files.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { WorkersModule } from './modules/jobs/workers.module.js';
import { LabelsModule } from './modules/labels/labels.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { RealtimeGatewayModule } from './modules/realtime/realtime-gateway.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { UsersModule } from './modules/users/users.module.js';

/** Infrastructure shared by the API and the worker process. */
export const CORE_IMPORTS = [
  AppConfigModule,
  LoggerModule,
  PrismaModule,
  RedisModule,
  QueueModule,
  StorageModule,
  RealtimeModule,
  NotificationsModule,
];

@Module({
  imports: [
    ...CORE_IMPORTS,
    ThrottlerModule.forRootAsync({
      inject: [AppConfig, REDIS_CLIENT],
      useFactory: (config: AppConfig, redis: Redis) => ({
        throttlers: [{ name: 'default', ttl: config.throttle.ttlMs, limit: config.throttle.limit }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    AccessModule,
    ActivityModule,
    AuditModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    LabelsModule,
    ProjectsModule,
    TasksModule,
    CommentsModule,
    FilesModule,
    AnalyticsModule,
    SearchModule,
    HealthModule,
    RealtimeGatewayModule,
    ConditionalModule.registerWhen(WorkersModule, (env) => env.RUN_WORKERS_IN_API === 'true'),
  ],
  providers: [
    // Order matters: authenticate → rate limit (per user or IP) → organization access.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
    { provide: APP_INTERCEPTOR, useClass: LogContextInterceptor },
  ],
})
export class AppModule {}
