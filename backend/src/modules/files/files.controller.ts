import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';

import type { AccessContext } from '../../common/auth/auth.types.js';
import { Access, RequirePermission } from '../../common/auth/decorators.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { ALLOWED_ATTACHMENT_TYPES } from '../../infrastructure/storage/file-type.js';

import {
  AttachmentDto,
  CreateUploadUrlDto,
  DownloadUrlDto,
  UploadUrlDto,
} from './dto/attachment.dto.js';
import { FilesService, type MultipartFile } from './files.service.js';

const ALLOWED_TYPES_DESCRIPTION = `Allowed types (verified from content): ${ALLOWED_ATTACHMENT_TYPES.join(', ')}.`;

@ApiTags('Files')
@ApiBearerAuth()
@Controller()
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Get('tasks/:taskId/attachments')
  @ApiOperation({ summary: 'Task attachments (newest first) with short-lived download URLs' })
  @ApiOkResponse({ type: [AttachmentDto] })
  list(@Access() access: AccessContext): Promise<AttachmentDto[]> {
    return this.files.list(access);
  }

  @Post('tasks/:taskId/attachments')
  @RequirePermission('files:upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload an attachment (multipart field `file`)',
    description: ALLOWED_TYPES_DESCRIPTION,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ type: AttachmentDto })
  @ApiPayloadTooLargeResponse({ type: ApiErrorDto })
  @ApiUnsupportedMediaTypeResponse({ type: ApiErrorDto })
  upload(
    @Access() access: AccessContext,
    @UploadedFile() file: MultipartFile | undefined,
  ): Promise<AttachmentDto> {
    return this.files.upload(access, file);
  }

  @Post('tasks/:taskId/attachments/upload-url')
  @RequirePermission('files:upload')
  @ApiOperation({
    summary: 'Direct upload, step 1: get a presigned PUT URL for object storage',
    description: `For large files. PUT the bytes to \`uploadUrl\` with \`headers\`, then call \`POST /attachments/{id}/complete\`. ${ALLOWED_TYPES_DESCRIPTION}`,
  })
  @ApiCreatedResponse({ type: UploadUrlDto })
  createUploadUrl(
    @Access() access: AccessContext,
    @Body() input: CreateUploadUrlDto,
  ): Promise<UploadUrlDto> {
    return this.files.createUploadUrl(access, input);
  }

  @Post('attachments/:attachmentId/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('files:upload')
  @ApiOperation({
    summary: 'Direct upload, step 2: verify the uploaded object and publish the attachment',
  })
  @ApiOkResponse({ type: AttachmentDto })
  complete(
    @Access() access: AccessContext,
    @Param('attachmentId') attachmentId: string,
  ): Promise<AttachmentDto> {
    return this.files.completeUpload(access, attachmentId);
  }

  @Get('attachments/:attachmentId/download')
  @ApiOperation({ summary: 'Fresh short-lived download URL for an attachment' })
  @ApiOkResponse({ type: DownloadUrlDto })
  download(
    @Access() access: AccessContext,
    @Param('attachmentId') attachmentId: string,
  ): Promise<DownloadUrlDto> {
    return this.files.downloadUrl(access, attachmentId);
  }

  @Delete('attachments/:attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('files:upload')
  @ApiOperation({ summary: 'Delete an attachment (the stored object is removed asynchronously)' })
  @ApiNoContentResponse()
  delete(
    @Access() access: AccessContext,
    @Param('attachmentId') attachmentId: string,
  ): Promise<void> {
    return this.files.delete(access, attachmentId);
  }
}
