import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AccessContext } from '../../common/auth/auth.types.js';
import { Access, RequirePermission } from '../../common/auth/decorators.js';
import type { CursorPage } from '../../common/utils/pagination.js';

import { AuditService } from './audit.service.js';
import { AuditLogDto, AuditLogPageDto, AuditLogQueryDto } from './dto/audit.dto.js';

@ApiTags('Audit log')
@ApiBearerAuth()
@Controller()
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('organizations/:organizationId/audit-logs')
  @RequirePermission('audit:read')
  @ApiOperation({
    summary: 'Security & administration audit trail (newest first, cursor-paginated)',
  })
  @ApiOkResponse({ type: AuditLogPageDto })
  list(
    @Access() access: AccessContext,
    @Query() query: AuditLogQueryDto,
  ): Promise<CursorPage<AuditLogDto>> {
    return this.audit.listForOrganization(access.organizationId, query);
  }
}
