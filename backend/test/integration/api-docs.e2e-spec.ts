import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { expectStatus, TestApp } from './harness.js';

interface Operation {
  summary?: string;
  tags?: string[];
  security?: Array<Record<string, string[]>>;
  requestBody?: unknown;
  responses: Record<string, { description?: string; content?: unknown }>;
}

interface OpenApiDocument {
  info: { title: string; description?: string };
  tags?: Array<{ name: string }>;
  paths: Record<string, Record<string, Operation>>;
  components: { securitySchemes?: Record<string, unknown> };
}

/** Routes that are intentionally callable without a bearer token. */
const PUBLIC_OPERATIONS = new Set([
  'post /api/v1/auth/register',
  'post /api/v1/auth/login',
  'post /api/v1/auth/refresh',
  'post /api/v1/auth/logout',
  'post /api/v1/auth/forgot-password',
  'post /api/v1/auth/reset-password',
  'post /api/v1/auth/verify-email',
  'post /api/v1/auth/resend-verification',
  'get /api/v1/users/{userId}/avatar',
  'get /health',
  'get /health/live',
]);

/**
 * The OpenAPI document is generated from the controllers; this keeps it
 * complete: every operation is summarized, tagged, documents its success
 * response and declares how it is authenticated.
 */
describe('API documentation (integration)', () => {
  let api: TestApp;
  let document: OpenApiDocument;
  const operations: Array<{ id: string; operation: Operation }> = [];

  beforeAll(async () => {
    api = await TestApp.start();
    const response = await api.call('get', '/docs-json');
    expectStatus(response, 200);
    document = response.body as OpenApiDocument;
    for (const [path, methods] of Object.entries(document.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        operations.push({ id: `${method} ${path}`, operation });
      }
    }
  });

  afterAll(async () => {
    await api?.close();
  });

  it('serves Swagger UI and documents authentication', async () => {
    const ui = await api.call('get', '/docs');
    expect([200, 301]).toContain(ui.status);
    expect(document.info.title).toBe('FlowSync API');
    expect(document.info.description).toMatch(/Authorization: Bearer/);
    expect(document.components.securitySchemes).toHaveProperty('bearer');
    expect(operations.length).toBeGreaterThan(80);
  });

  it('summarizes and tags every operation with declared tags', () => {
    const declared = new Set(document.tags?.map((tag) => tag.name));
    const offenders = operations
      .filter(
        ({ operation }) =>
          !operation.summary ||
          !operation.tags?.length ||
          operation.tags.some((tag) => !declared.has(tag)),
      )
      .map(({ id, operation }) => `${id} (${operation.tags?.join(',') ?? 'untagged'})`);
    expect(offenders).toEqual([]);
  });

  it('documents a success response for every operation', () => {
    const offenders = operations
      .filter(
        ({ operation }) => !Object.keys(operation.responses).some((code) => /^[23]/.test(code)),
      )
      .map(({ id }) => id);
    expect(offenders).toEqual([]);
  });

  it('declares bearer authentication on every protected operation', () => {
    const offenders = operations
      .filter(({ id, operation }) => {
        const bearer = operation.security?.some((requirement) => 'bearer' in requirement) ?? false;
        return PUBLIC_OPERATIONS.has(id) ? bearer : !bearer;
      })
      .map(({ id }) => id);
    expect(offenders).toEqual([]);
  });

  it('matches the documented public surface with what the API actually allows', async () => {
    for (const id of PUBLIC_OPERATIONS) {
      expect(
        operations.map((entry) => entry.id),
        id,
      ).toContain(id);
    }
    // Spot-check: an operation documented as protected really is.
    expect((await api.get('/organizations')).status).toBe(401);
  });
});
