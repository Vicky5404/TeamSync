import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables, NodeEnv } from './env.validation.js';

type Env = EnvironmentVariables;

function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false' || value === '') return false;
  const hops = Number(value);
  return Number.isInteger(hops) ? hops : value;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

/**
 * Typed, grouped view over the validated environment. Inject this instead of
 * `ConfigService` so every consumer shares one source of truth.
 */
@Injectable()
export class AppConfig {
  readonly nodeEnv: NodeEnv;
  readonly isProduction: boolean;
  readonly isTest: boolean;

  readonly http: {
    port: number;
    /** Without leading/trailing slashes, e.g. `api/v1`. */
    prefix: string;
    appUrl: string;
    publicApiUrl: string;
    corsOrigins: string[];
    trustProxy: boolean | number | string;
    swaggerEnabled: boolean;
    swaggerPath: string;
  };

  readonly logging: { level: Env['LOG_LEVEL']; pretty: boolean };

  readonly database: { url: string; poolSize: number };

  readonly redis: { url: string; keyPrefix: string };

  readonly auth: {
    accessSecret: string;
    accessTtlSeconds: number;
    issuer: string;
    audience: string;
    refreshTtlLongMs: number;
    refreshTtlShortMs: number;
    requireEmailVerification: boolean;
    loginMaxAttempts: number;
    loginLockoutSeconds: number;
    cookie: {
      name: string;
      secure: boolean;
      sameSite: 'strict' | 'lax' | 'none';
      domain: string | undefined;
      /** Refresh cookie is only sent to the auth routes. */
      path: string;
    };
  };

  readonly throttle: { ttlMs: number; limit: number };

  readonly storage: {
    bucket: string;
    region: string;
    endpoint: string | undefined;
    publicEndpoint: string | undefined;
    accessKeyId: string | undefined;
    secretAccessKey: string | undefined;
    forcePathStyle: boolean;
    maxUploadBytes: number;
    maxAvatarBytes: number;
    signedUrlTtlSeconds: number;
  };

  readonly mail: {
    transport: 'smtp' | 'log';
    host: string;
    port: number;
    secure: boolean;
    user: string | undefined;
    password: string | undefined;
    from: string;
  };

  readonly workers: { runInApi: boolean; healthPort: number };

  constructor(config: ConfigService<Env, true>) {
    const get = <K extends keyof Env>(key: K): Env[K] => config.get(key, { infer: true });

    this.nodeEnv = get('NODE_ENV');
    this.isProduction = this.nodeEnv === 'production';
    this.isTest = this.nodeEnv === 'test';

    const prefix = trimSlashes(get('API_PREFIX'));
    this.http = {
      port: get('PORT'),
      prefix,
      appUrl: get('APP_URL').replace(/\/+$/, ''),
      publicApiUrl: get('PUBLIC_API_URL').replace(/\/+$/, ''),
      corsOrigins: get('CORS_ORIGINS')
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean),
      trustProxy: parseTrustProxy(get('TRUST_PROXY')),
      swaggerEnabled: get('SWAGGER_ENABLED') ?? !this.isProduction,
      swaggerPath: trimSlashes(get('SWAGGER_PATH')),
    };

    this.logging = { level: get('LOG_LEVEL'), pretty: get('LOG_PRETTY') };
    this.database = { url: get('DATABASE_URL'), poolSize: get('DATABASE_POOL_SIZE') };
    this.redis = { url: get('REDIS_URL'), keyPrefix: get('REDIS_KEY_PREFIX') };

    this.auth = {
      accessSecret: get('JWT_ACCESS_SECRET'),
      accessTtlSeconds: get('JWT_ACCESS_TTL'),
      issuer: get('JWT_ISSUER'),
      audience: get('JWT_AUDIENCE'),
      refreshTtlLongMs: get('REFRESH_TOKEN_TTL_DAYS') * 86_400_000,
      refreshTtlShortMs: get('REFRESH_TOKEN_SHORT_TTL_HOURS') * 3_600_000,
      requireEmailVerification: get('AUTH_REQUIRE_EMAIL_VERIFICATION'),
      loginMaxAttempts: get('LOGIN_MAX_ATTEMPTS'),
      loginLockoutSeconds: get('LOGIN_LOCKOUT_MINUTES') * 60,
      cookie: {
        name: get('REFRESH_COOKIE_NAME'),
        secure: get('COOKIE_SECURE'),
        sameSite: get('COOKIE_SAMESITE'),
        domain: get('COOKIE_DOMAIN'),
        path: `/${prefix ? `${prefix}/` : ''}auth`,
      },
    };

    this.throttle = { ttlMs: get('THROTTLE_TTL_SECONDS') * 1000, limit: get('THROTTLE_LIMIT') };

    this.storage = {
      bucket: get('S3_BUCKET'),
      region: get('S3_REGION'),
      endpoint: get('S3_ENDPOINT'),
      publicEndpoint: get('S3_PUBLIC_ENDPOINT'),
      accessKeyId: get('S3_ACCESS_KEY_ID'),
      secretAccessKey: get('S3_SECRET_ACCESS_KEY'),
      forcePathStyle: get('S3_FORCE_PATH_STYLE'),
      maxUploadBytes: get('UPLOAD_MAX_FILE_SIZE_MB') * 1024 * 1024,
      maxAvatarBytes: get('AVATAR_MAX_FILE_SIZE_MB') * 1024 * 1024,
      signedUrlTtlSeconds: get('SIGNED_URL_TTL_SECONDS'),
    };

    this.mail = {
      transport: get('MAIL_TRANSPORT'),
      host: get('SMTP_HOST'),
      port: get('SMTP_PORT'),
      secure: get('SMTP_SECURE'),
      user: get('SMTP_USER'),
      password: get('SMTP_PASSWORD'),
      from: get('MAIL_FROM'),
    };

    this.workers = {
      runInApi: get('RUN_WORKERS_IN_API'),
      healthPort: get('WORKER_HEALTH_PORT'),
    };
  }

  /** Absolute link into the web client, e.g. `appLink('/reset-password', { token })`. */
  appLink(path: string, query: Record<string, string> = {}): string {
    const url = new URL(path, `${this.http.appUrl}/`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    return url.toString();
  }
}
