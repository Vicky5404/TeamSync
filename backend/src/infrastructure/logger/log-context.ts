/**
 * Process-wide log context: which service is logging and which build. Set by
 * the entry point (`main.ts` → API, `worker.ts` → worker) before Nest boots.
 */
let serviceName = 'flowsync-api';

export function setServiceName(name: string): void {
  serviceName = name;
}

export function logBase(nodeEnv: string): Record<string, string> {
  return { service: serviceName, env: nodeEnv, version: process.env.APP_VERSION ?? 'dev' };
}

/** Query parameters whose values may carry credentials or personal data. */
const SENSITIVE_QUERY_PARAMS = new Set([
  'token',
  'code',
  'password',
  'email',
  'search',
  'q',
  'query',
  'access_token',
  'refresh_token',
]);

/**
 * The request URL as it should appear in logs: path and parameter names are
 * kept for debugging, values of sensitive parameters are replaced.
 */
export function sanitizeUrl(url: string | undefined): string {
  if (!url) return '';
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return url;
  const params = new URLSearchParams(url.slice(queryStart + 1));
  let redacted = false;
  for (const key of new Set(params.keys())) {
    if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
      params.set(key, '[REDACTED]');
      redacted = true;
    }
  }
  if (!redacted) return url;
  return `${url.slice(0, queryStart)}?${params.toString().replaceAll('%5BREDACTED%5D', '[REDACTED]')}`;
}
