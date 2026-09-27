import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { inject } from 'vitest';

import type { Role } from '../../src/generated/prisma/enums.js';
import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service.js';

export const ORIGIN = 'http://localhost:5173';
export const PASSWORD = 'Correct-Horse-9-Battery';
const PREFIX = '/api/v1';

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

export interface TestUser {
  id: string;
  name: string;
  email: string;
  /** Client address used for this user's requests (rate limits are per IP when anonymous). */
  ip: string;
  accessToken: string;
  /** `name=value` of the httpOnly refresh-token cookie. */
  refreshCookie: string;
  sessionId: string;
}

export interface TestOrganization {
  id: string;
  name: string;
  slug: string;
}

export interface TestProject {
  id: string;
  key: string;
}

let ipCounter = 0;

/** A distinct client address per call (the app trusts X-Forwarded-For in tests). */
export function nextIp(): string {
  ipCounter += 1;
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

const unique = () => randomBytes(4).toString('hex');

/**
 * The real API (every module, guard, pipe and filter, background workers
 * in-process) listening on an ephemeral port, plus helpers that drive it
 * through HTTP exactly like the web client does.
 */
export class TestApp {
  private constructor(
    readonly app: NestExpressApplication,
    readonly baseUrl: string,
    readonly prisma: PrismaService,
    private readonly issueVerificationToken: (userId: string) => Promise<string>,
  ) {}

  static async start(overrides: Record<string, string> = {}): Promise<TestApp> {
    const s3 = inject('s3');
    // Must be set before the application modules are imported (configuration
    // is validated when the config module is first loaded).
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: inject('databaseUrl'),
      DATABASE_POOL_SIZE: '5',
      REDIS_URL: inject('redisUrl'),
      REDIS_KEY_PREFIX: `flowsync-it:${unique()}:`,
      JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
      TRUST_PROXY: 'true',
      CORS_ORIGINS: ORIGIN,
      APP_URL: ORIGIN,
      PUBLIC_API_URL: PREFIX,
      RUN_WORKERS_IN_API: 'true',
      WORKER_HEALTH_PORT: '0',
      MAIL_TRANSPORT: 'log',
      LOG_LEVEL: 'silent',
      LOG_PRETTY: 'false',
      SWAGGER_ENABLED: 'true',
      AUTH_REQUIRE_EMAIL_VERIFICATION: 'true',
      LOGIN_MAX_ATTEMPTS: '5',
      S3_BUCKET: s3.bucket,
      S3_ENDPOINT: s3.endpoint,
      S3_PUBLIC_ENDPOINT: s3.endpoint,
      S3_REGION: s3.region,
      S3_ACCESS_KEY_ID: s3.accessKeyId,
      S3_SECRET_ACCESS_KEY: s3.secretAccessKey,
      S3_FORCE_PATH_STYLE: 'true',
      UPLOAD_MAX_FILE_SIZE_MB: '1',
      ...overrides,
    });

    const { AppModule } = await import('../../src/app.module.js');
    const { configureApp } = await import('../../src/bootstrap/configure-app.js');
    const { PrismaService } = await import('../../src/infrastructure/prisma/prisma.service.js');
    const { UserTokensService } = await import('../../src/modules/auth/user-tokens.service.js');
    const { UserTokenType } = await import('../../src/generated/prisma/enums.js');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      bufferLogs: true,
    });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;

    const tokens = app.get(UserTokensService);
    return new TestApp(app, `http://127.0.0.1:${port}`, app.get(PrismaService), (userId) =>
      tokens.issue(userId, UserTokenType.EMAIL_VERIFICATION),
    );
  }

  async close(): Promise<void> {
    await this.app.close();
  }

  /** Raw request against the API prefix. */
  call(method: Method, path: string, options: { as?: TestUser; ip?: string } = {}) {
    const url = path.startsWith('/health') ? path : `${PREFIX}${path}`;
    let test = request(this.app.getHttpServer())
      [method](url)
      .set('X-Forwarded-For', options.as?.ip ?? options.ip ?? nextIp())
      .set('Accept', 'application/json');
    if (options.as) test = test.set('Authorization', `Bearer ${options.as.accessToken}`);
    return test;
  }

  get = (path: string, as?: TestUser) => this.call('get', path, { as });
  post = (path: string, body: object | undefined, as?: TestUser) =>
    this.call('post', path, { as }).send(body);
  patch = (path: string, body: object, as?: TestUser) =>
    this.call('patch', path, { as }).send(body);
  delete = (path: string, as?: TestUser) => this.call('delete', path, { as });

  /** Sign up, confirm the email (as the emailed link would) and sign in. */
  async createUser(name = 'Test User', email = `user-${unique()}@it.example`): Promise<TestUser> {
    const ip = nextIp();
    const registered = await this.call('post', '/auth/register', { ip }).send({
      name,
      email,
      password: PASSWORD,
    });
    expectStatus(registered, 201);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { email } });
    const token = await this.issueVerificationToken(user.id);
    expectStatus(await this.call('post', '/auth/verify-email', { ip }).send({ token }), 204);
    return this.login(email, name, ip);
  }

  async login(email: string, name: string, ip = nextIp()): Promise<TestUser> {
    const response = await this.call('post', '/auth/login', { ip }).send({
      email,
      password: PASSWORD,
    });
    expectStatus(response, 200);
    const body = response.body as { accessToken: string; user: { id: string } };
    const session = await this.prisma.session.findFirstOrThrow({
      where: { userId: body.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return {
      id: body.user.id,
      name,
      email,
      ip,
      accessToken: body.accessToken,
      refreshCookie: refreshCookie(response),
      sessionId: session.id,
    };
  }

  async createOrganization(owner: TestUser, name = 'Org'): Promise<TestOrganization> {
    const slug = `org-${unique()}`;
    const response = await this.post('/organizations', { name, slug }, owner);
    expectStatus(response, 201);
    return { id: (response.body as { id: string }).id, name, slug };
  }

  /** Invite an email with a role; the new account joins automatically once verified. */
  async addMember(
    admin: TestUser,
    organization: TestOrganization,
    role: Role,
    name = `${role.toLowerCase()} user`,
  ): Promise<TestUser> {
    const email = `${role.toLowerCase()}-${unique()}@it.example`;
    expectStatus(
      await this.post(
        `/organizations/${organization.id}/invitations`,
        { emails: [email], role },
        admin,
      ),
      201,
    );
    return this.createUser(name, email);
  }

  async createProject(
    user: TestUser,
    organization: TestOrganization,
    memberIds: string[] = [],
  ): Promise<TestProject> {
    const key = `P${unique()
      .slice(0, 4)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, 'X')}`;
    const response = await this.post(
      `/organizations/${organization.id}/projects`,
      { name: `Project ${key}`, key, memberIds },
      user,
    );
    expectStatus(response, 201);
    return { id: (response.body as { id: string }).id, key };
  }

  async createTask(user: TestUser, project: TestProject, body: object = {}) {
    const response = await this.post(
      `/projects/${project.id}/tasks`,
      { title: `Task ${unique()}`, ...body },
      user,
    );
    expectStatus(response, 201);
    return response.body as TaskBody;
  }
}

export interface TaskBody {
  id: string;
  identifier: string;
  title: string;
  status: string;
  position: number;
  completedAt: string | null;
  assignee: { id: string } | null;
}

export function refreshCookie(response: Response): string {
  const header = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = header?.find((value) => value.startsWith('flowsync_rt='));
  if (!cookie) throw new Error('No refresh cookie was set');
  return cookie.split(';')[0] ?? '';
}

/** Assert a status with the response body in the failure message. */
export function expectStatus(response: Response, status: number): void {
  if (response.status !== status) {
    throw new Error(
      `Expected ${status} for ${response.request.method} ${response.request.url}, got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }
}

/** Poll until `check` returns a value (background jobs, pub/sub). */
export async function eventually<T>(
  check: () => Promise<T | null | undefined | false>,
  { timeoutMs = 10_000, intervalMs = 100 } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('Condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
