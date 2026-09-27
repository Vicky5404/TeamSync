import { z } from 'zod';

/** Treat empty strings from `.env` files as "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema);

/**
 * Resolve the WebSocket endpoint. Accepts absolute `ws://` / `wss://` URLs or a
 * same-origin path such as `/ws`, which follows the page's scheme (http → ws,
 * https → wss) so one build works behind any host.
 */
function resolveWebsocketUrl(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol === 'http:') url.protocol = 'ws:';
    if (url.protocol === 'https:') url.protocol = 'wss:';
    return url.protocol === 'ws:' || url.protocol === 'wss:' ? url.toString() : null;
  } catch {
    return null;
  }
}

const websocketUrl = z
  .string()
  .refine((value) => resolveWebsocketUrl(value) !== null, 'must be a ws(s):// URL or a path');

const envSchema = z.object({
  VITE_APP_NAME: optional(z.string().default('FlowSync')),
  VITE_API_BASE_URL: optional(z.string().default('/api/v1')),
  VITE_API_TIMEOUT_MS: optional(z.coerce.number().int().positive().default(15_000)),
  VITE_WS_URL: optional(websocketUrl.optional()),
  VITE_UPLOAD_MAX_FILE_SIZE_MB: optional(z.coerce.number().positive().default(25)),
});

function parseEnv() {
  const result = envSchema.safeParse(import.meta.env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  const values = result.data;
  return {
    appName: values.VITE_APP_NAME,
    apiBaseUrl: values.VITE_API_BASE_URL.replace(/\/+$/, ''),
    apiTimeoutMs: values.VITE_API_TIMEOUT_MS,
    wsUrl: values.VITE_WS_URL ? resolveWebsocketUrl(values.VITE_WS_URL) : null,
    /** Mirrors the API's `UPLOAD_MAX_FILE_SIZE_MB` for instant client-side validation. */
    uploadMaxFileSizeBytes: Math.floor(values.VITE_UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024),
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
  } as const;
}

/** Validated, typed runtime configuration. Import this instead of `import.meta.env`. */
export const env = parseEnv();
