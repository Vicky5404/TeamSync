import { existsSync } from 'node:fs';

import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads `.env` on its own. Real environment variables
// (CI/CD, containers) always win because loadEnvFile never overwrites them.
if (existsSync('.env')) process.loadEnvFile('.env');

const databaseUrl = process.env.DATABASE_URL;
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // `prisma generate` does not need a connection; migrate/studio/seed do.
  datasource: databaseUrl
    ? { url: databaseUrl, ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}) }
    : undefined,
});
