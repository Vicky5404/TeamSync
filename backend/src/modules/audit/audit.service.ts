import { Injectable } from '@nestjs/common';

import { toUserSummary, userSummarySelect } from '../../common/dto/user-summary.dto.js';
import {
  afterCursor,
  type CursorPage,
  keysetOrder,
  resolveLimit,
  toCursorPage,
} from '../../common/utils/pagination.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

import type { AuditEntry, AuditMetadata } from './audit.types.js';
import type { AuditLogDto, AuditLogQueryDto } from './dto/audit.dto.js';

type Db = PrismaService | Prisma.TransactionClient;

const auditInclude = {
  actor: { select: userSummarySelect },
} as const satisfies Prisma.AuditLogInclude;
type AuditLogRow = Prisma.AuditLogGetPayload<{ include: typeof auditInclude }>;

/**
 * Immutable audit trail. Entries are written inside the transaction of the
 * change they describe, so an event is recorded if and only if it happened.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entries: AuditEntry | AuditEntry[], db: Db = this.prisma): Promise<void> {
    const list = Array.isArray(entries) ? entries : [entries];
    if (list.length === 0) return;
    await db.auditLog.createMany({
      data: list.map((entry) => ({
        organizationId: entry.organizationId,
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ?? {},
        ipAddress: entry.client?.ipAddress ?? null,
        userAgent: entry.client?.userAgent ?? null,
        requestId: entry.client?.requestId ?? null,
      })),
    });
  }

  async listForOrganization(
    organizationId: string,
    query: AuditLogQueryDto,
  ): Promise<CursorPage<AuditLogDto>> {
    const limit = resolveLimit(query.limit);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        organizationId,
        ...(query.action ? { action: query.action } : {}),
        ...(query.actorId ? { actorId: query.actorId } : {}),
        ...afterCursor(query.cursor),
      },
      include: auditInclude,
      orderBy: keysetOrder,
      take: limit + 1,
    });
    return toCursorPage(rows, limit, toAuditLogDto);
  }
}

export function toAuditLogDto(row: AuditLogRow): AuditLogDto {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actor: row.actorId ? toUserSummary(row.actor, row.actorId) : null,
    metadata: (row.metadata ?? {}) as AuditMetadata,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
  };
}
