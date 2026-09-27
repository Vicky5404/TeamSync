import axios, { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Reply = { status: number; data?: unknown };

/** Route requests to a fake backend; records every request for assertions. */
function fakeBackend(handler: (config: InternalAxiosRequestConfig) => Reply) {
  const requests: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = (config) => {
    requests.push(config);
    const reply = handler(config);
    const response = {
      status: reply.status,
      statusText: '',
      data: reply.data ?? {},
      headers: {},
      config,
    };
    if (reply.status >= 400) {
      return Promise.reject(
        new axios.AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, response),
      );
    }
    return Promise.resolve(response);
  };
  return { adapter, requests };
}

const session = (accessToken: string) => ({
  accessToken,
  expiresIn: 900,
  user: { id: 'u1', name: 'Demo', email: 'demo@example.com' },
});

describe('http client', () => {
  const originalAdapter = axios.defaults.adapter;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    axios.defaults.adapter = originalAdapter;
  });

  // Clients are created at import time and pick up the adapter then; the store
  // is imported fresh too so the test and the client share one instance.
  async function loadClient(handler: (config: InternalAxiosRequestConfig) => Reply) {
    const backend = fakeBackend(handler);
    axios.defaults.adapter = backend.adapter;
    const { useAuthStore } = await import('@/store/auth.store');
    useAuthStore.setState({ accessToken: 'expired-token', status: 'authenticated' });
    const module = await import('./client');
    return { ...module, useAuthStore, requests: backend.requests };
  }

  it('attaches the bearer token and a request id', async () => {
    const { http, requests } = await loadClient(() => ({ status: 200, data: { ok: true } }));
    await http.get('/projects');
    expect(requests[0]?.headers.get('Authorization')).toBe('Bearer expired-token');
    expect(requests[0]?.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('refreshes once for concurrent 401s and retries the original requests', async () => {
    let refreshes = 0;
    const { http, requests, useAuthStore } = await loadClient((config) => {
      if (config.url === '/auth/refresh') {
        refreshes += 1;
        return { status: 200, data: session('fresh-token') };
      }
      const token = config.headers.get('Authorization');
      return token === 'Bearer fresh-token' ? { status: 200, data: { ok: true } } : { status: 401 };
    });

    const results = await Promise.all([http.get('/a'), http.get('/b'), http.get('/c')]);

    expect(results.map((response) => response.status)).toEqual([200, 200, 200]);
    expect(refreshes).toBe(1);
    expect(useAuthStore.getState().accessToken).toBe('fresh-token');
    // 3 rejected + 1 refresh + 3 retried
    expect(requests).toHaveLength(7);
  });

  it('ends the session when the refresh token is rejected', async () => {
    const { http, useAuthStore } = await loadClient((config) =>
      config.url === '/auth/refresh'
        ? { status: 401, data: { code: 'UNAUTHORIZED', message: 'No active session.' } }
        : { status: 401 },
    );

    await expect(http.get('/projects')).rejects.toMatchObject({ status: 401 });
    const state = useAuthStore.getState();
    expect(state.status).toBe('unauthenticated');
    expect(state.accessToken).toBeNull();
    expect(state.sessionExpired).toBe(true);
  });

  it('never refreshes for requests that opt out (public endpoints)', async () => {
    const { http, requests } = await loadClient(() => ({
      status: 401,
      data: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' },
    }));
    await expect(
      http.post('/auth/login', {}, { skipAuth: true, skipAuthRefresh: true }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.headers.get('Authorization')).toBeUndefined();
  });
});
