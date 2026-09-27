import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AccessContext } from '../../common/auth/auth.types.js';
import { Access, RequirePermission } from '../../common/auth/decorators.js';
import { uuidParam } from '../../common/pipes/uuid-param.pipe.js';

import { CreateLabelDto, LabelDto, UpdateLabelDto } from './dto/label.dto.js';
import { LabelsService } from './labels.service.js';

@ApiTags('Labels')
@ApiBearerAuth()
@Controller('organizations/:organizationId/labels')
export class LabelsController {
  constructor(private readonly labels: LabelsService) {}

  @Get()
  @ApiOperation({ summary: 'Organization labels' })
  @ApiOkResponse({ type: [LabelDto] })
  list(@Access() access: AccessContext): Promise<LabelDto[]> {
    return this.labels.list(access.organizationId);
  }

  @Post()
  @RequirePermission('labels:manage')
  @ApiOperation({ summary: 'Create a label' })
  @ApiCreatedResponse({ type: LabelDto })
  create(@Access() access: AccessContext, @Body() input: CreateLabelDto): Promise<LabelDto> {
    return this.labels.create(access.organizationId, input);
  }

  @Patch(':labelId')
  @RequirePermission('labels:manage')
  @ApiOperation({ summary: 'Rename or recolor a label' })
  @ApiOkResponse({ type: LabelDto })
  update(
    @Access() access: AccessContext,
    @Param('labelId', uuidParam('Label')) labelId: string,
    @Body() input: UpdateLabelDto,
  ): Promise<LabelDto> {
    return this.labels.update(access.organizationId, labelId, input);
  }

  @Delete(':labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('labels:manage')
  @ApiOperation({ summary: 'Delete a label (removes it from all tasks)' })
  @ApiNoContentResponse()
  delete(
    @Access() access: AccessContext,
    @Param('labelId', uuidParam('Label')) labelId: string,
  ): Promise<void> {
    return this.labels.delete(access.organizationId, labelId);
  }
}
