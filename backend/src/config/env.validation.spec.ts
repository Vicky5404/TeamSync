import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import { AppConfig } from './app-config.js';
import { type EnvironmentVariables, validateEnv } from './env.validation.js';

const REQUIRED = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a-sufficiently-long-random-secret-for-tests-123',
};

describe('validateEnv', () => {
  it('applies development defaults', () => {
    const env = validateEnv({ ...REQUIRED });
    expect(env.PORT).toBe(4000);
    expect(env.API_PREFIX).toBe('api/v1');
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.AUTH_REQUIRE_EMAIL_VERIFICATION).toBe(true);
    expect(env.THROTTLE_LIMIT).toBe(300);
  });

  it('parses numbers and booleans from strings (and treats empty strings as unset)', () => {
    const env = validateEnv({
      ...REQUIRED,
      PORT: '8080',
      COOKIE_SECURE: 'true',
      RUN_WORKERS_IN_API: 'false',
      S3_ENDPOINT: '',
    });
    expect(env.PORT).toBe(8080);
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.RUN_WORKERS_IN_API).toBe(false);
    expect(env.S3_ENDPOINT).toBeUndefined();
  });

  it('rejects missing or weak secrets', () => {
    expect(() => validateEnv({ DATABASE_URL: REQUIRED.DATABASE_URL })).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => validateEnv({ ...REQUIRED, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /at least 32 characters/,
    );
    expect(() => validateEnv({ ...REQUIRED, PORT: 'not-a-port' })).toThrow(/PORT/);
  });

  it('refuses unsafe production settings', () => {
    expect(() =>
      validateEnv({ ...REQUIRED, NODE_ENV: 'production', MAIL_TRANSPORT: 'smtp' }),
    ).toThrow(/COOKIE_SECURE must be true/);
    expect(() =>
      validateEnv({
        ...REQUIRED,
        NODE_ENV: 'production',
        COOKIE_SECURE: 'true',
        MAIL_TRANSPORT: 'smtp',
        JWT_ACCESS_SECRET: 'dev-only-change-me-0123456789abcdefghijklmnop',
      }),
    ).toThrow(/example value/);
    expect(() =>
      validateEnv({
        ...REQUIRED,
        NODE_ENV: 'production',
        COOKIE_SECURE: 'true',
        MAIL_TRANSPORT: 'log',
      }),
    ).toThrow(/MAIL_TRANSPORT=log/);
    expect(() =>
      validateEnv({
        ...REQUIRED,
        NODE_ENV: 'production',
        COOKIE_SECURE: 'true',
        MAIL_TRANSPORT: 'smtp',
      }),
    ).not.toThrow();
  });

  it('serves Swagger by default outside production, and in production only on request', () => {
    const appConfig = (raw: Record<string, unknown>) => {
      const env = validateEnv({ ...REQUIRED, MAIL_TRANSPORT: 'smtp', ...raw });
      return new AppConfig({
        get: (key: keyof EnvironmentVariables) => env[key],
      } as unknown as ConfigService<EnvironmentVariables, true>);
    };
    expect(appConfig({}).http.swaggerEnabled).toBe(true);
    expect(appConfig({ SWAGGER_ENABLED: 'false' }).http.swaggerEnabled).toBe(false);
    const production = { NODE_ENV: 'production', COOKIE_SECURE: 'true' };
    expect(appConfig(production).http.swaggerEnabled).toBe(false);
    expect(appConfig({ ...production, SWAGGER_ENABLED: 'true' }).http.swaggerEnabled).toBe(true);
  });

  it('configures the worker health port (0 disables it)', () => {
    expect(validateEnv({ ...REQUIRED }).WORKER_HEALTH_PORT).toBe(4001);
    expect(validateEnv({ ...REQUIRED, WORKER_HEALTH_PORT: '0' }).WORKER_HEALTH_PORT).toBe(0);
    expect(() => validateEnv({ ...REQUIRED, WORKER_HEALTH_PORT: '70000' })).toThrow(
      /WORKER_HEALTH_PORT/,
    );
  });
});
