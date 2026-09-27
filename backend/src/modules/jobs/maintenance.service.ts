import { Injectable } from '@nestjs/common';

import { DAY_MS } from '../../common/utils/dates.js';
import { AttachmentStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { StorageKeys } from '../../infrastructure/storage/storage-keys.js';
import { StorageService } from '../../infrastructure/storage/storage.service.js';

/** How long soft-deleted projects, tasks and comments stay restorable. */
export const TRASH_RETENTION_MS = 30 * DAY_MS;
const AUDIT_LOG_RETENTION_MS = 365 * DAY_MS;
/** Hard-deleting a project cascades to all of its tasks, so purge few at a time. */
const PROJECT_PURGE_BATCH = 20;
const SESSION_RETENTION_MS = 7 * DAY_MS;
const TOKEN_RETENTION_MS = 7 * DAY_MS;
const READ_NOTIFICATION_RETENTION_MS = 90 * DAY_MS;
const NOTIFICATION_RETENTION_MS = 365 * DAY_MS;
const PENDING_UPLOAD_TTL_MS = DAY_MS;
const REPORT_RETENTION_MS = 30 * DAY_MS;
const BATCH = 500;

/** Retention and garbage collection (run by the maintenance worker on a schedule). */
@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Expired or revoked device sessions. */
  async cleanupSessions(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - SESSION_RETENTION_MS);
    const { count } = await this.prisma.session.deleteMany({
      where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
    });
    return count;
  }

  /** Used or expired verification/reset tokens. */
  async cleanupTokens(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - TOKEN_RETENTION_MS);
    const [tokens, invitations] = await this.prisma.$transaction([
      this.prisma.userToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: cutoff } }, { consumedAt: { lt: cutoff } }] },
      }),
      this.prisma.invitation.deleteMany({
        where: { expiresAt: { lt: new Date(now.getTime() - 30 * DAY_MS) } },
      }),
    ]);
    return tokens.count + invitations.count;
  }

  async cleanupNotifications(now = new Date()): Promise<number> {
    const { count } = await this.prisma.notification.deleteMany({
      where: {
        OR: [
          { readAt: { lt: new Date(now.getTime() - READ_NOTIFICATION_RETENTION_MS) } },
          { createdAt: { lt: new Date(now.getTime() - NOTIFICATION_RETENTION_MS) } },
        ],
      },
    });
    return count;
  }

  /** Direct uploads that were never completed: delete the objects, then the rows. */
  async cleanupPendingUploads(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - PENDING_UPLOAD_TTL_MS);
    let removed = 0;
    for (;;) {
      const pending = await this.prisma.attachment.findMany({
        where: { status: AttachmentStatus.PENDING, createdAt: { lt: cutoff } },
        select: { id: true, storageKey: true },
        take: BATCH,
      });
      if (pending.length === 0) break;
      await this.storage.deleteObjects(pending.map((row) => row.storageKey));
      await this.prisma.attachment.deleteMany({
        where: { id: { in: pending.map((row) => row.id) } },
      });
      removed += pending.length;
      if (pending.length < BATCH) break;
    }
    return removed;
  }

  async cleanupReports(now = new Date()): Promise<number> {
    const reports = await this.prisma.report.findMany({
      where: { createdAt: { lt: new Date(now.getTime() - REPORT_RETENTION_MS) } },
      select: { id: true, storageKey: true },
      take: 5_000,
    });
    if (reports.length === 0) return 0;
    const keys = reports
      .map((report) => report.storageKey)
      .filter((key): key is string => key !== null);
    if (keys.length > 0) await this.storage.deleteObjects(keys);
    const { count } = await this.prisma.report.deleteMany({
      where: { id: { in: reports.map((report) => report.id) } },
    });
    return count;
  }

  /**
   * Permanently delete projects, tasks and comments that have been in the
   * trash longer than the retention window. Stored files are removed before
   * the rows, so a failed run is simply retried (both steps are idempotent).
   */
  async purgeTrash(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - TRASH_RETENTION_MS);
    let purged = 0;

    // Projects first: the cascade removes their tasks, comments, files' metadata and activity.
    for (;;) {
      const projects = await this.prisma.project.findMany({
        where: { deletedAt: { lt: cutoff } },
        select: { id: true, organizationId: true },
        take: PROJECT_PURGE_BATCH,
      });
      if (projects.length === 0) break;
      for (const project of projects) {
        await this.storage.deletePrefix(StorageKeys.project(project.organizationId, project.id));
      }
      const { count } = await this.prisma.project.deleteMany({
        where: { id: { in: projects.map((project) => project.id) }, deletedAt: { lt: cutoff } },
      });
      purged += count;
      if (projects.length < PROJECT_PURGE_BATCH) break;
    }

    // Tasks that were trashed on their own.
    for (;;) {
      const tasks = await this.prisma.task.findMany({
        where: { deletedAt: { lt: cutoff } },
        select: { id: true, organizationId: true, projectId: true },
        take: BATCH,
      });
      if (tasks.length === 0) break;
      for (const task of tasks) {
        await this.storage.deletePrefix(
          StorageKeys.task(task.organizationId, task.projectId, task.id),
        );
      }
      const { count } = await this.prisma.task.deleteMany({
        where: { id: { in: tasks.map((task) => task.id) }, deletedAt: { lt: cutoff } },
      });
      purged += count;
      if (tasks.length < BATCH) break;
    }

    const comments = await this.prisma.comment.deleteMany({
      where: { deletedAt: { lt: cutoff } },
    });
    return purged + comments.count;
  }

  /** Audit entries older than the retention period (deleting is allowed; updating is not). */
  async cleanupAuditLogs(now = new Date()): Promise<number> {
    const { count } = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - AUDIT_LOG_RETENTION_MS) } },
    });
    return count;
  }

  purgePrefix(prefix: string): Promise<number> {
    return this.storage.deletePrefix(prefix);
  }

  async deleteObjects(keys: string[]): Promise<number> {
    await this.storage.deleteObjects(keys);
    return keys.length;
  }
}
