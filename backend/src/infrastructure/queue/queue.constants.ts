import type { JobsOptions } from 'bullmq';

import type { NotificationType } from '../../generated/prisma/enums.js';

export const QueueName = {
  NOTIFICATIONS: 'notifications',
  EMAIL: 'email',
  REPORTS: 'reports',
  MAINTENANCE: 'maintenance',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];

export const JobName = {
  // notifications
  DELIVER_NOTIFICATIONS: 'deliver-notifications',
  SCAN_DUE_SOON: 'scan-due-soon',
  // email
  SEND_EMAIL: 'send-email',
  // reports
  GENERATE_REPORT: 'generate-report',
  // maintenance
  CLEANUP_SESSIONS: 'cleanup-sessions',
  CLEANUP_TOKENS: 'cleanup-tokens',
  CLEANUP_NOTIFICATIONS: 'cleanup-notifications',
  CLEANUP_PENDING_UPLOADS: 'cleanup-pending-uploads',
  CLEANUP_REPORTS: 'cleanup-reports',
  CLEANUP_AUDIT_LOGS: 'cleanup-audit-logs',
  PURGE_TRASH: 'purge-trash',
  PURGE_STORAGE_PREFIX: 'purge-storage-prefix',
  DELETE_STORAGE_OBJECTS: 'delete-storage-objects',
} as const;

// ---------------------------------------------------------------------------
// Job payloads
// ---------------------------------------------------------------------------

export interface NotificationResource {
  type: 'task' | 'project' | 'organization';
  id: string;
  projectId?: string;
}

/** A notification to deliver to one user (subject to their preferences). */
export interface NotificationIntent {
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  actorId: string | null;
  organizationId: string | null;
  resource: NotificationResource | null;
}

export interface DeliverNotificationsJob {
  intents: NotificationIntent[];
}

export type EmailTemplate =
  | { template: 'verify-email'; data: { name: string; link: string } }
  | { template: 'reset-password'; data: { name: string; link: string } }
  | {
      template: 'invitation';
      data: {
        organizationName: string;
        inviterName: string;
        role: string;
        message: string | null;
        link: string;
      };
    }
  | { template: 'notification'; data: { title: string; body: string | null; link: string | null } };

export type SendEmailJob = EmailTemplate & { to: string };

export interface GenerateReportJob {
  reportId: string;
}

export interface PurgeStoragePrefixJob {
  prefix: string;
}

export interface DeleteStorageObjectsJob {
  keys: string[];
}

// ---------------------------------------------------------------------------
// Retry policies
// ---------------------------------------------------------------------------

const keep = { removeOnComplete: { age: 86_400, count: 1_000 }, removeOnFail: { age: 7 * 86_400 } };

/** Default options per queue: retries with exponential backoff, bounded retention. */
export const QUEUE_DEFAULT_JOB_OPTIONS: Record<QueueName, JobsOptions> = {
  [QueueName.NOTIFICATIONS]: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2_000 },
    ...keep,
  },
  // Email payloads carry one-time links (verification, password reset, invitations):
  // drop them from Redis as soon as they are sent, and keep failures for one day only.
  [QueueName.EMAIL]: {
    attempts: 6,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: true,
    removeOnFail: { age: 86_400 },
  },
  [QueueName.REPORTS]: { attempts: 3, backoff: { type: 'exponential', delay: 15_000 }, ...keep },
  [QueueName.MAINTENANCE]: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    ...keep,
  },
};
