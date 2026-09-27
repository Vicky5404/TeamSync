import { describe, expect, it } from 'vitest';

import { logBase, sanitizeUrl, setServiceName } from './log-context.js';
import { REDACTED_PATHS } from './logger.module.js';

describe('log context', () => {
  it('redacts sensitive query parameter values but keeps the rest of the URL', () => {
    expect(sanitizeUrl('/api/v1/organizations/o1/tasks?search=alex%40example.com&page=2')).toBe(
      '/api/v1/organizations/o1/tasks?search=[REDACTED]&page=2',
    );
    expect(sanitizeUrl('/api/v1/x?Token=abc&email=a@b.c&q=secret')).toBe(
      '/api/v1/x?Token=[REDACTED]&email=[REDACTED]&q=[REDACTED]',
    );
    expect(sanitizeUrl('/api/v1/projects?page=1&sort=name')).toBe(
      '/api/v1/projects?page=1&sort=name',
    );
    expect(sanitizeUrl('/health')).toBe('/health');
    expect(sanitizeUrl(undefined)).toBe('');
  });

  it('tags every log line with the service, environment and version', () => {
    setServiceName('flowsync-worker');
    expect(logBase('production')).toEqual({
      service: 'flowsync-worker',
      env: 'production',
      version: process.env.APP_VERSION ?? 'dev',
    });
    setServiceName('flowsync-api');
  });

  it('never logs credentials, tokens, cookies or email addresses', () => {
    for (const path of [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.refreshToken',
      '*.email',
    ]) {
      expect(REDACTED_PATHS).toContain(path);
    }
  });
});
