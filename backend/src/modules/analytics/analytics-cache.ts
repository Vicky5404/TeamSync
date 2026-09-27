/**
 * Analytics responses are cached per organization under a version counter.
 * Any write that changes task/project/member data bumps the version, which
 * invalidates every cached analytics entry for that organization at once.
 */
export const analyticsNamespace = (organizationId: string) => `analytics:${organizationId}`;

export const ANALYTICS_CACHE_TTL_SECONDS = 300;
