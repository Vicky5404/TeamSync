import { randomUUID } from 'node:crypto';

/**
 * Object key layout. Everything owned by an organization lives under
 * `orgs/<orgId>/`, so deleting an organization, project or task can purge its
 * files with a single prefix sweep.
 */
export const StorageKeys = {
  organization: (organizationId: string) => `orgs/${organizationId}/`,

  project: (organizationId: string, projectId: string) =>
    `orgs/${organizationId}/projects/${projectId}/`,

  task: (organizationId: string, projectId: string, taskId: string) =>
    `orgs/${organizationId}/projects/${projectId}/tasks/${taskId}/`,

  /** Random component prevents enumeration; the extension is derived from the verified type. */
  attachment: (organizationId: string, projectId: string, taskId: string, extension: string) =>
    `${StorageKeys.task(organizationId, projectId, taskId)}${randomUUID()}.${extension}`,

  report: (organizationId: string, reportId: string, extension: string) =>
    `orgs/${organizationId}/reports/${reportId}.${extension}`,

  avatar: (userId: string, extension: string) => `avatars/${userId}/${randomUUID()}.${extension}`,
} as const;
