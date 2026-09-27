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

import { CommentsService } from './comments.service.js';
import { CommentDto, CreateCommentDto, UpdateCommentDto } from './dto/comment.dto.js';

@ApiTags('Comments')
@ApiBearerAuth()
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('tasks/:taskId/comments')
  @ApiOperation({ summary: 'Comments on a task (oldest first)' })
  @ApiOkResponse({ type: [CommentDto] })
  list(@Access() access: AccessContext): Promise<CommentDto[]> {
    return this.comments.list(access);
  }

  @Post('tasks/:taskId/comments')
  @RequirePermission('comments:create')
  @ApiOperation({ summary: 'Comment on a task (supports mentions)' })
  @ApiCreatedResponse({ type: CommentDto })
  create(@Access() access: AccessContext, @Body() input: CreateCommentDto): Promise<CommentDto> {
    return this.comments.create(access, input);
  }

  /** `commentId` is resolved to its task/organization by `AccessGuard`. */
  @Patch('comments/:commentId')
  @RequirePermission('comments:create')
  @ApiOperation({ summary: 'Edit your comment' })
  @ApiOkResponse({ type: CommentDto })
  update(
    @Access() access: AccessContext,
    @Param('commentId') commentId: string,
    @Body() input: UpdateCommentDto,
  ): Promise<CommentDto> {
    return this.comments.update(access, commentId, input);
  }

  @Delete('comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a comment (author, or admins moderating)' })
  @ApiNoContentResponse()
  delete(@Access() access: AccessContext, @Param('commentId') commentId: string): Promise<void> {
    return this.comments.delete(access, commentId);
  }
}
