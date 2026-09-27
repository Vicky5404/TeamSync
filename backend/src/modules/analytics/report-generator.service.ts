import { Injectable, Logger } from '@nestjs/common';

import { CSV_BOM, csvRow } from '../../common/utils/csv.js';
import { toISODate } from '../../common/utils/dates.js';
import type { Report } from '../../generated/prisma/client.js';
import { ReportStatus, ReportType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { StorageKeys } from '../../infrastructure/storage/storage-keys.js';
import { StorageService } from '../../infrastructure/storage/storage.service.js';
import { projectTaskStats } from '../projects/project-stats.js';
import { RealtimeEvent } from '../realtime/realtime.events.js';
import { RealtimePublisher } from '../realtime/realtime.publisher.js';

import { ReportsService } from './reports.service.js';

const BATCH_SIZE = 1_000;

/** Worker-side CSV report generation. Idempotent: re-running overwrites the same object key. */
@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly realtime: RealtimePublisher,
    private readonly reports: ReportsService,
  ) {}

  async generate(reportId: string): Promise<void> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      this.logger.warn({ reportId }, 'Report no longer exists; skipping');
      return;
    }
    if (report.status === ReportStatus.COMPLETED) return;
    await this.prisma.report.update({
      where: { id: reportId },
      data: { status: ReportStatus.PROCESSING, error: null },
    });

    const lines =
      report.type === ReportType.TASK_EXPORT
        ? await this.taskExport(report)
        : await this.projectSummary(report);
    const body = Buffer.from(CSV_BOM + lines.join('\r\n') + '\r\n', 'utf8');
    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `${report.type === ReportType.TASK_EXPORT ? 'tasks' : 'projects'}-${stamp}.csv`;
    const key = StorageKeys.report(report.organizationId, report.id, 'csv');
    await this.storage.putObject(key, body, { contentType: 'text/csv; charset=utf-8', fileName });

    const completed = await this.prisma.report.update({
      where: { id: reportId },
      data: { status: ReportStatus.COMPLETED, storageKey: key, fileName, completedAt: new Date() },
    });
    this.logger.log({ reportId, rows: lines.length - 1, bytes: body.length }, 'Report generated');
    if (completed.requestedById) {
      void this.realtime.publishToUser(
        RealtimeEvent.REPORT_READY,
        completed.requestedById,
        await this.reports.toDto(completed),
      );
    }
  }

  /** Called when the job has exhausted its retries. */
  async markFailed(reportId: string, error: unknown): Promise<void> {
    await this.prisma.report
      .update({
        where: { id: reportId },
        data: {
          status: ReportStatus.FAILED,
          error: (error instanceof Error ? error.message : 'Report generation failed').slice(
            0,
            500,
          ),
        },
      })
      .catch(() => undefined);
  }

  private async taskExport(report: Report): Promise<string[]> {
    const params = (report.params ?? {}) as { projectId?: string };
    const lines = [
      csvRow([
        'Identifier',
        'Title',
        'Project',
        'Status',
        'Priority',
        'Assignee',
        'Reporter',
        'Labels',
        'Due date',
        'Created',
        'Completed',
      ]),
    ];
    let cursor: string | undefined;
    for (;;) {
      const tasks = await this.prisma.task.findMany({
        where: {
          organizationId: report.organizationId,
          deletedAt: null,
          ...(params.projectId ? { projectId: params.projectId } : {}),
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          createdAt: true,
          completedAt: true,
          project: { select: { key: true, name: true } },
          assignee: { select: { email: true } },
          reporter: { select: { email: true } },
          labels: { select: { label: { select: { name: true } } } },
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
      });
      for (const task of tasks) {
        lines.push(
          csvRow([
            `${task.project.key}-${task.number}`,
            task.title,
            task.project.name,
            task.status,
            task.priority,
            task.assignee?.email ?? '',
            task.reporter?.email ?? '',
            task.labels.map(({ label }) => label.name).join('; '),
            toISODate(task.dueDate) ?? '',
            task.createdAt.toISOString(),
            task.completedAt?.toISOString() ?? '',
          ]),
        );
      }
      if (tasks.length < BATCH_SIZE) break;
      cursor = tasks.at(-1)?.id;
    }
    return lines;
  }

  private async projectSummary(report: Report): Promise<string[]> {
    const projects = await this.prisma.project.findMany({
      where: { organizationId: report.organizationId, deletedAt: null },
      select: {
        id: true,
        key: true,
        name: true,
        status: true,
        startDate: true,
        dueDate: true,
        _count: { select: { members: true } },
      },
      orderBy: { name: 'asc' },
    });
    const stats = await projectTaskStats(
      this.prisma,
      projects.map((project) => project.id),
    );
    return [
      csvRow([
        'Key',
        'Name',
        'Status',
        'Members',
        'Tasks',
        'Completed',
        'Overdue',
        'Progress %',
        'Start date',
        'Due date',
      ]),
      ...projects.map((project) => {
        const entry = stats.get(project.id);
        return csvRow([
          project.key,
          project.name,
          project.status,
          project._count.members,
          entry?.total ?? 0,
          entry?.completed ?? 0,
          entry?.overdue ?? 0,
          entry?.progress ?? 0,
          toISODate(project.startDate) ?? '',
          toISODate(project.dueDate) ?? '',
        ]);
      }),
    ];
  }
}
