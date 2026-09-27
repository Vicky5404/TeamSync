import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { AppConfig } from '../../config/app-config.js';
import { PrismaClient } from '../../generated/prisma/client.js';

/** Prisma client bound to a pooled `pg` driver adapter; connected for the app's lifetime. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: AppConfig) {
    const logger = new Logger(PrismaService.name);
    const adapter = new PrismaPg(
      {
        connectionString: config.database.url,
        max: config.database.poolSize,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 30_000,
        // Guard against runaway queries and abandoned transactions holding
        // connections and row locks.
        statement_timeout: 30_000,
        idle_in_transaction_session_timeout: 60_000,
        application_name: 'flowsync-api',
      },
      { onPoolError: (error) => logger.error({ err: error }, 'PostgreSQL pool error') },
    );
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL');
    const [row] = await this.$queryRaw<Array<{ server_encoding: string }>>`SHOW server_encoding`;
    if (row && row.server_encoding.toUpperCase() !== 'UTF8') {
      this.logger.warn(
        `Database encoding is ${row.server_encoding}, not UTF8 — non-ASCII names and text will be rejected. Create the database with ENCODING 'UTF8'.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Round-trip latency to the database (health checks). */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
