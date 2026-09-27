import { plainToInstance, Transform, type TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/** Treat empty strings from `.env` files as "not set". */
const emptyToUndefined = ({ value }: TransformFnParams): unknown =>
  value === '' ? undefined : value;

const toBoolean = ({ obj, key }: TransformFnParams): unknown => {
  const raw: unknown = (obj as Record<string, unknown>)[key];
  if (raw === undefined || raw === '') return undefined;
  if (typeof raw === 'boolean') return raw;
  return typeof raw === 'string' && ['true', '1', 'yes', 'on'].includes(raw.toLowerCase());
};

const toInt = ({ obj, key }: TransformFnParams): unknown => {
  const raw: unknown = (obj as Record<string, unknown>)[key];
  if (raw === undefined || raw === '') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : raw;
};

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

/**
 * Every environment variable the API and workers read. Validated once at
 * startup — invalid configuration fails fast with a descriptive error.
 * Defaults are development-friendly; production must set secrets explicitly.
 */
export class EnvironmentVariables {
  // --- Runtime ---------------------------------------------------------------
  @IsIn(NODE_ENVS)
  NODE_ENV: NodeEnv = 'development';

  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 4000;

  /** Global route prefix, without leading/trailing slashes. */
  @Matches(/^[a-z0-9/_-]*$/i)
  API_PREFIX = 'api/v1';

  /** Web client origin used to build links in emails. */
  @IsUrl({ require_tld: false, require_protocol: true })
  APP_URL = 'http://localhost:5173';

  /** Base URL browsers use to reach this API (absolute, or relative behind a proxy). */
  @IsString()
  PUBLIC_API_URL = '/api/v1';

  /** Comma-separated list of allowed browser origins (CORS + WebSocket origin check). */
  @IsString()
  CORS_ORIGINS = 'http://localhost:5173';

  /** Express `trust proxy` setting: `false`, `true`, a hop count, or a subnet list. */
  @IsString()
  TRUST_PROXY = 'false';

  @IsIn(LOG_LEVELS)
  LOG_LEVEL: (typeof LOG_LEVELS)[number] = 'info';

  @Transform(toBoolean)
  LOG_PRETTY = false;

  /** Swagger UI + OpenAPI JSON. Defaults to on, except in production (opt in explicitly). */
  @Transform(toBoolean)
  @IsOptional()
  SWAGGER_ENABLED?: boolean;

  @Matches(/^[a-z0-9/_-]+$/i)
  SWAGGER_PATH = 'docs';

  /** Run BullMQ workers inside the API process (convenient locally; use `npm run start:worker` in production). */
  @Transform(toBoolean)
  RUN_WORKERS_IN_API = false;

  /** Port of the worker process's health endpoint (`/health`, `/health/live`); 0 disables it. */
  @Transform(toInt)
  @IsInt()
  @Min(0)
  @Max(65535)
  WORKER_HEALTH_PORT = 4001;

  // --- PostgreSQL ------------------------------------------------------------
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(200)
  DATABASE_POOL_SIZE = 10;

  // --- Redis -----------------------------------------------------------------
  @IsString()
  @IsNotEmpty()
  REDIS_URL = 'redis://localhost:6379';

  /** Namespace for cache/rate-limit/pub-sub keys (BullMQ uses its own `bull:` prefix). */
  @IsString()
  REDIS_KEY_PREFIX = 'flowsync:';

  // --- Authentication --------------------------------------------------------
  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters' })
  JWT_ACCESS_SECRET!: string;

  /** Access-token lifetime in seconds. */
  @Transform(toInt)
  @IsInt()
  @Min(60)
  @Max(3600)
  JWT_ACCESS_TTL = 900;

  @IsString()
  JWT_ISSUER = 'flowsync-api';

  @IsString()
  JWT_AUDIENCE = 'flowsync-web';

  /** Refresh-token lifetime with "keep me signed in" (sliding). */
  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(365)
  REFRESH_TOKEN_TTL_DAYS = 30;

  /** Refresh-token lifetime without "keep me signed in" (sliding). */
  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(720)
  REFRESH_TOKEN_SHORT_TTL_HOURS = 24;

  @Matches(/^[A-Za-z0-9_-]+$/)
  REFRESH_COOKIE_NAME = 'flowsync_rt';

  @Transform(toBoolean)
  COOKIE_SECURE = false;

  @IsIn(['strict', 'lax', 'none'])
  COOKIE_SAMESITE: 'strict' | 'lax' | 'none' = 'lax';

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  COOKIE_DOMAIN?: string;

  @Transform(toBoolean)
  AUTH_REQUIRE_EMAIL_VERIFICATION = true;

  @Transform(toInt)
  @IsInt()
  @Min(1)
  LOGIN_MAX_ATTEMPTS = 5;

  @Transform(toInt)
  @IsInt()
  @Min(1)
  LOGIN_LOCKOUT_MINUTES = 15;

  // --- Rate limiting ---------------------------------------------------------
  @Transform(toInt)
  @IsInt()
  @Min(1)
  THROTTLE_TTL_SECONDS = 60;

  @Transform(toInt)
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT = 300;

  // --- Object storage (S3-compatible) ----------------------------------------
  @IsString()
  @IsNotEmpty()
  S3_BUCKET = 'flowsync';

  @IsString()
  S3_REGION = 'us-east-1';

  /** Custom endpoint for S3-compatible stores (MinIO, R2…). Empty for AWS. */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  S3_ENDPOINT?: string;

  /** Endpoint used in presigned URLs when browsers reach storage via a different host. */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  S3_PUBLIC_ENDPOINT?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  S3_ACCESS_KEY_ID?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  S3_SECRET_ACCESS_KEY?: string;

  @Transform(toBoolean)
  S3_FORCE_PATH_STYLE = false;

  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(5120)
  UPLOAD_MAX_FILE_SIZE_MB = 25;

  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(20)
  AVATAR_MAX_FILE_SIZE_MB = 5;

  /** Lifetime of presigned download/upload URLs. */
  @Transform(toInt)
  @IsInt()
  @Min(60)
  @Max(604800)
  SIGNED_URL_TTL_SECONDS = 900;

  // --- Email -----------------------------------------------------------------
  /** `smtp` delivers through SMTP; `log` only logs messages (local development). */
  @IsIn(['smtp', 'log'])
  MAIL_TRANSPORT: 'smtp' | 'log' = 'log';

  @IsString()
  SMTP_HOST = 'localhost';

  @Transform(toInt)
  @IsInt()
  SMTP_PORT = 1025;

  @Transform(toBoolean)
  SMTP_SECURE = false;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  @IsString()
  MAIL_FROM = 'FlowSync <no-reply@flowsync.dev>';
}

function formatErrors(errors: ReturnType<typeof validateSync>): string {
  return errors
    .map((error) => `  - ${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`)
    .join('\n');
}

/** `ConfigModule` validation hook. Throws (and aborts startup) on invalid configuration. */
export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, raw, { exposeDefaultValues: true });
  const errors = validateSync(env, { skipMissingProperties: false, forbidUnknownValues: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n${formatErrors(errors)}`);
  }
  if (env.NODE_ENV === 'production') {
    const problems: string[] = [];
    if (!env.COOKIE_SECURE) problems.push('COOKIE_SECURE must be true in production');
    if (env.COOKIE_SAMESITE === 'none' && !env.COOKIE_SECURE) {
      problems.push('COOKIE_SAMESITE=none requires COOKIE_SECURE=true');
    }
    if (/change-me|dev-only/i.test(env.JWT_ACCESS_SECRET)) {
      problems.push('JWT_ACCESS_SECRET still uses the example value');
    }
    // The log transport prints message bodies (which contain one-time links) to the logs.
    if (env.MAIL_TRANSPORT === 'log')
      problems.push('MAIL_TRANSPORT=log is for local development only');
    if (problems.length > 0) {
      throw new Error(`Unsafe production configuration:\n  - ${problems.join('\n  - ')}`);
    }
  }
  return env;
}
