import { Injectable } from '@nestjs/common';

import type { AccessContext } from '../../common/auth/auth.types.js';
import { Errors } from '../../common/errors/api-exception.js';
import { toUserSummary, userSummarySelect } from '../../common/dto/user-summary.dto.js';
import { AppConfig } from '../../config/app-config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AttachmentStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { QueueService } from '../../infrastructure/queue/queue.service.js';
import {
  detectFileType,
  ruleForFileName,
  sanitizeFileName,
  SNIFF_BYTES,
} from '../../infrastructure/storage/file-type.js';
import { StorageKeys } from '../../infrastructure/storage/storage-keys.js';
import { StorageService } from '../../infrastructure/storage/storage.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { ActivityAction, taskTarget } from '../activity/activity.types.js';
import { TasksService } from '../tasks/tasks.service.js';

import type {
  AttachmentDto,
  CreateUploadUrlDto,
  DownloadUrlDto,
  UploadUrlDto,
} from './dto/attachment.dto.js';

export interface MultipartFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

const attachmentInclude = {
  uploadedBy: { select: userSummarySelect },
} as const satisfies Prisma.AttachmentInclude;
type AttachmentRow = Prisma.AttachmentGetPayload<{ include: typeof attachmentInclude }>;

const MAX_ATTACHMENTS_PER_TASK = 100;
const UNSUPPORTED_MESSAGE = `Unsupported file type. Allowed: images, PDF, Office documents, ZIP and text files.`;

/** Multer decodes multipart file names as latin1; recover UTF-8 names. */
function decodeFileName(name: string): string {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
}

/**
 * Task attachments. Bytes live in private object storage; PostgreSQL keeps
 * metadata only. Types are verified from file contents, sizes are capped, and
 * downloads use short-lived presigned URLs that force `Content-Disposition:
 * attachment` so uploaded content can never render inline on our origin.
 */
@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly activity: ActivityService,
    private readonly tasks: TasksService,
    private readonly config: AppConfig,
  ) {}

  async list(access: AccessContext): Promise<AttachmentDto[]> {
    const rows = await this.prisma.attachment.findMany({
      where: { taskId: requireTaskId(access), status: AttachmentStatus.READY },
      include: attachmentInclude,
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(rows.map((row) => this.toDto(row)));
  }

  /** Upload through the API (multipart field `file`). */
  async upload(access: AccessContext, file: MultipartFile | undefined): Promise<AttachmentDto> {
    if (!file) throw Errors.field('file', 'A file is required');
    const task = await this.requireTask(access);
    if (file.size > this.config.storage.maxUploadBytes)
      throw Errors.payloadTooLarge('The file is too large.');
    await this.assertCapacity(task.id);

    const fileName = sanitizeFileName(decodeFileName(file.originalname));
    const type = detectFileType(fileName, file.buffer.subarray(0, SNIFF_BYTES));
    if (!type) throw Errors.unsupportedMediaType(UNSUPPORTED_MESSAGE);

    const key = StorageKeys.attachment(
      access.organizationId,
      task.projectId,
      task.id,
      type.extension,
    );
    await this.storage.putObject(key, file.buffer, { contentType: type.mime, fileName });

    const attachment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.attachment.create({
        data: {
          organizationId: access.organizationId,
          taskId: task.id,
          uploadedById: access.userId,
          fileName,
          mimeType: type.mime,
          size: file.size,
          storageKey: key,
          status: AttachmentStatus.READY,
          uploadedAt: new Date(),
        },
        include: attachmentInclude,
      });
      await this.recordUpload(access, task, fileName, tx);
      return created;
    });
    await this.tasks.republish(access.organizationId, task.id);
    return this.toDto(attachment);
  }

  /** Step 1 of a direct-to-storage upload: reserve a key and return a presigned PUT URL. */
  async createUploadUrl(access: AccessContext, input: CreateUploadUrlDto): Promise<UploadUrlDto> {
    const task = await this.requireTask(access);
    if (input.size > this.config.storage.maxUploadBytes)
      throw Errors.payloadTooLarge('The file is too large.');
    await this.assertCapacity(task.id);
    const fileName = sanitizeFileName(input.fileName);
    const rule = ruleForFileName(fileName);
    if (!rule) throw Errors.unsupportedMediaType(UNSUPPORTED_MESSAGE, 'fileName');

    const key = StorageKeys.attachment(
      access.organizationId,
      task.projectId,
      task.id,
      rule.extension,
    );
    const expiresIn = this.config.storage.signedUrlTtlSeconds;
    const attachment = await this.prisma.attachment.create({
      data: {
        organizationId: access.organizationId,
        taskId: task.id,
        uploadedById: access.userId,
        fileName,
        mimeType: rule.mime,
        size: input.size,
        storageKey: key,
        status: AttachmentStatus.PENDING,
      },
    });
    const upload = await this.storage.presignUpload(key, {
      contentType: rule.mime,
      contentLength: input.size,
      expiresIn,
    });
    return {
      attachmentId: attachment.id,
      uploadUrl: upload.url,
      method: 'PUT',
      headers: upload.headers,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  /** Step 2: verify what was uploaded (size + content sniffing) before exposing it. */
  async completeUpload(access: AccessContext, attachmentId: string): Promise<AttachmentDto> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, organizationId: access.organizationId },
      include: attachmentInclude,
    });
    if (!attachment) throw Errors.notFound('Attachment');
    if (attachment.status === AttachmentStatus.READY) return this.toDto(attachment);
    if (attachment.uploadedById !== access.userId) throw Errors.forbidden();

    const head = await this.storage.headObject(attachment.storageKey);
    if (!head) throw Errors.field('file', 'The file has not been uploaded yet');
    const bytes = await this.storage.readRange(attachment.storageKey, SNIFF_BYTES);
    const type = detectFileType(attachment.fileName, bytes);
    if (head.size !== attachment.size || !type) {
      await this.prisma.attachment.delete({ where: { id: attachment.id } });
      await this.queue.deleteStorageObjects([attachment.storageKey]);
      throw Errors.unsupportedMediaType(
        'The uploaded file does not match its declared name, type or size.',
      );
    }

    const task = await this.requireTask(access);
    const ready = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.attachment.update({
        where: { id: attachment.id },
        data: { status: AttachmentStatus.READY, mimeType: type.mime, uploadedAt: new Date() },
        include: attachmentInclude,
      });
      await this.recordUpload(access, task, attachment.fileName, tx);
      return updated;
    });
    await this.tasks.republish(access.organizationId, task.id);
    return this.toDto(ready);
  }

  async downloadUrl(access: AccessContext, attachmentId: string): Promise<DownloadUrlDto> {
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        organizationId: access.organizationId,
        status: AttachmentStatus.READY,
      },
    });
    if (!attachment) throw Errors.notFound('Attachment');
    const expiresIn = this.config.storage.signedUrlTtlSeconds;
    return {
      url: await this.storage.presignDownload(attachment.storageKey, {
        fileName: attachment.fileName,
        expiresIn,
      }),
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async delete(access: AccessContext, attachmentId: string): Promise<void> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, organizationId: access.organizationId },
    });
    if (!attachment) throw Errors.notFound('Attachment');
    await this.prisma.attachment.delete({ where: { id: attachment.id } });
    await this.queue.deleteStorageObjects([attachment.storageKey]);
    await this.tasks.republish(access.organizationId, attachment.taskId);
  }

  // -------------------------------------------------------------------------

  private async toDto(row: AttachmentRow): Promise<AttachmentDto> {
    return {
      id: row.id,
      taskId: row.taskId,
      fileName: row.fileName,
      mimeType: row.mimeType,
      size: row.size,
      url: await this.storage.presignDownload(row.storageKey, { fileName: row.fileName }),
      uploadedBy: toUserSummary(row.uploadedBy, row.uploadedById ?? ''),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async requireTask(access: AccessContext) {
    const task = await this.prisma.task.findFirst({
      where: { id: requireTaskId(access), organizationId: access.organizationId, deletedAt: null },
      select: {
        id: true,
        title: true,
        number: true,
        projectId: true,
        project: { select: { key: true } },
      },
    });
    if (!task) throw Errors.notFound('Task');
    return task;
  }

  private async assertCapacity(taskId: string): Promise<void> {
    const count = await this.prisma.attachment.count({ where: { taskId } });
    if (count >= MAX_ATTACHMENTS_PER_TASK)
      throw Errors.field('file', 'This task has too many attachments');
  }

  private async recordUpload(
    access: AccessContext,
    task: {
      id: string;
      title: string;
      number: number;
      projectId: string;
      project: { key: string };
    },
    fileName: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await this.activity.record(
      {
        organizationId: access.organizationId,
        projectId: task.projectId,
        taskId: task.id,
        actorId: access.userId,
        action: ActivityAction.TASK_ATTACHMENT_ADDED,
        target: taskTarget(task),
        metadata: { fileName },
      },
      tx,
    );
  }
}

function requireTaskId(access: AccessContext): string {
  if (!access.taskId) throw Errors.notFound('Task');
  return access.taskId;
}
