/** Injection token for the shared ioredis command connection. */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/** Pub/sub channel carrying real-time events between API instances and workers. */
export const REALTIME_CHANNEL = 'realtime:events';
