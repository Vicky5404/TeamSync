import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';

import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import pg from 'pg';
import type { TestProject } from 'vitest/node';

/**
 * Provisions isolated infrastructure for one integration run:
 * - a fresh PostgreSQL database with every migration applied (`migrate deploy`,
 *   exactly like a release), dropped afterwards;
 * - a fresh S3 bucket, emptied and deleted afterwards;
 * - a dedicated Redis logical database (keys are also namespaced per test file).
 *
 * Defaults match the root docker-compose.yml; override with INTEGRATION_* env vars.
 */
const ADMIN_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ?? 'postgresql://flowsync:flowsync@localhost:5432/postgres';
const REDIS_URL = process.env.INTEGRATION_REDIS_URL ?? 'redis://localhost:6379/9';
const S3 = {
  endpoint: process.env.INTEGRATION_S3_ENDPOINT ?? 'http://localhost:9000',
  region: 'us-east-1',
  accessKeyId: process.env.INTEGRATION_S3_ACCESS_KEY_ID ?? 'flowsync',
  secretAccessKey: process.env.INTEGRATION_S3_SECRET_ACCESS_KEY ?? 'flowsync-secret',
};

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    redisUrl: string;
    s3: typeof S3 & { bucket: string };
  }
}

function databaseUrl(name: string): string {
  const url = new URL(ADMIN_DATABASE_URL);
  url.pathname = `/${name}`;
  url.searchParams.set('schema', 'public');
  return url.toString();
}

async function admin<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: ADMIN_DATABASE_URL });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

async function emptyAndDeleteBucket(s3: S3Client, bucket: string): Promise<void> {
  for (;;) {
    const listing = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
    const keys = (listing.Contents ?? []).flatMap((object) =>
      object.Key ? [{ Key: object.Key }] : [],
    );
    if (keys.length === 0) break;
    await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }));
  }
  await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const suffix = `${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
  const database = `flowsync_it_${suffix}`;
  const bucket = `flowsync-it-${suffix.replace('_', '-')}`;

  // Identifiers are generated above, never user input.
  await admin((client) =>
    client.query(`CREATE DATABASE "${database}" ENCODING 'UTF8' TEMPLATE template0`),
  );
  const url = databaseUrl(database);

  const require = createRequire(import.meta.url);
  const prismaCli = require.resolve('prisma/build/index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url, SHADOW_DATABASE_URL: '' },
    stdio: 'pipe',
  });

  const s3 = new S3Client({
    endpoint: S3.endpoint,
    region: S3.region,
    forcePathStyle: true,
    credentials: { accessKeyId: S3.accessKeyId, secretAccessKey: S3.secretAccessKey },
  });
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));

  project.provide('databaseUrl', url);
  project.provide('redisUrl', REDIS_URL);
  project.provide('s3', { ...S3, bucket });

  return async () => {
    await emptyAndDeleteBucket(s3, bucket).catch((error: unknown) =>
      console.warn(`Could not delete bucket ${bucket}:`, error),
    );
    s3.destroy();
    await admin((client) => client.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`));
  };
}
