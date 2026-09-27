import { defineConfig } from 'vitest/config';

/**
 * Integration tests: the real Nest application against real PostgreSQL, Redis
 * and S3-compatible storage (see test/integration/README.md). Each run gets a
 * throwaway database and bucket; files run one after another, each booting
 * its own application instance.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/integration/**/*.e2e-spec.ts'],
    globalSetup: ['./test/integration/global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    restoreMocks: true,
  },
});
