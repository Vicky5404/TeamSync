import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import { env } from '@/lib/env';
import { useAuthStore } from '@/store/auth.store';
import type { AuthSession } from '@/types';

import { type ApiError, ERROR_CODES, toApiError } from './errors';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Do not attach the bearer token (public endpoints). */
    skipAuth?: boolean;
    /** Do not attempt a token refresh when this request returns 401. */
    skipAuthRefresh?: boolean;
    /** Internal: marks a request that has already been retried after a refresh. */
    _retried?: boolean;
  }
}

function createClient(): AxiosInstance {
  return axios.create({
    baseURL: env.apiBaseUrl,
    timeout: env.apiTimeoutMs,
    // Sends the httpOnly refresh-token cookie on same-site / CORS-enabled requests.
    withCredentials: true,
    headers: { Accept: 'application/json' },
    // Serialize arrays as `status=A&status=B`.
    paramsSerializer: { indexes: null },
  });
}

/** Primary API client used by every service module. */
export const http = createClient();

/**
 * Bare client for the refresh call. It has no interceptors, so a failing
 * refresh can never recursively trigger another refresh.
 */
const refreshClient = createClient();

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token && !config.skipAuth) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  if (!config.headers.has('X-Request-Id')) {
    config.headers.set('X-Request-Id', crypto.randomUUID());
  }
  return config;
});

let refreshInFlight: Promise<AuthSession> | null = null;

/**
 * Exchange the refresh-token cookie for a new access token. Concurrent callers
 * share a single in-flight request (single-flight) so a burst of 401s triggers
 * exactly one refresh.
 */
export function refreshSession(): Promise<AuthSession> {
  refreshInFlight ??= refreshClient
    .post<AuthSession>('/auth/refresh')
    .then((response) => {
      useAuthStore.getState().setAccessToken(response.data.accessToken);
      return response.data;
    })
    .catch((error: unknown) => {
      throw toApiError(error);
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/**
 * Developer-facing log line for a request that ultimately failed. Expected
 * failures (4xx) are only logged in development; server and network errors are
 * always logged with the request id so they can be correlated with API logs.
 */
function logApiFailure(error: ApiError, config: InternalAxiosRequestConfig | undefined): void {
  if (error.code === ERROR_CODES.CANCELED) return;
  const serious = error.status === 0 || error.status >= 500;
  if (!serious && !env.isDev) return;
  const method = config?.method?.toUpperCase() ?? 'REQUEST';
  const target = `${method} ${config?.url ?? ''}`;
  const reference = error.requestId ?? config?.headers.get('X-Request-Id');
  const details = [`${error.status || 'no response'} ${error.code}`, error.message];
  if (typeof reference === 'string') details.push(`request ${reference}`);
  const log = serious ? console.error : console.warn;
  const fieldErrors = Object.keys(error.fieldErrors).length > 0 ? [error.fieldErrors] : [];
  log(`[api] ${target} failed:`, details.join(' · '), ...fieldErrors);
}

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const apiError = toApiError(error);
    const config = axios.isAxiosError(error) ? error.config : undefined;
    const hadSession = useAuthStore.getState().accessToken !== null;

    if (
      apiError.isUnauthorized &&
      config &&
      hadSession &&
      !config.skipAuth &&
      !config.skipAuthRefresh &&
      !config._retried
    ) {
      config._retried = true;
      let session: AuthSession;
      try {
        session = await refreshSession();
      } catch (refreshError) {
        const normalized = toApiError(refreshError);
        if (normalized.isUnauthorized) {
          useAuthStore.getState().expireSession();
        } else {
          logApiFailure(normalized, config);
        }
        throw normalized;
      }
      config.headers.set('Authorization', `Bearer ${session.accessToken}`);
      try {
        // A failure of the retried request is logged by this interceptor.
        return await http.request(config);
      } catch (retryError) {
        const normalized = toApiError(retryError);
        if (normalized.isUnauthorized) {
          useAuthStore.getState().expireSession();
        }
        throw normalized;
      }
    }

    logApiFailure(apiError, config);
    throw apiError;
  },
);
