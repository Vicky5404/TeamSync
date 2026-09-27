import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiFoundResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import type { AuthUser } from '../../common/auth/auth.types.js';
import { CurrentUser, Public } from '../../common/auth/decorators.js';
import { Errors } from '../../common/errors/api-exception.js';
import { uuidParam } from '../../common/pipes/uuid-param.pipe.js';

import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UserDto } from './dto/user.dto.js';
import { type UploadedFile as UploadedAvatar, UsersService } from './users.service.js';

// Bearer auth is declared per route: the avatar redirect is public.
@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the current user’s profile' })
  @ApiOkResponse({ type: UserDto })
  updateProfile(@CurrentUser() user: AuthUser, @Body() input: UpdateProfileDto): Promise<UserDto> {
    return this.users.updateProfile(user.id, input);
  }

  @Post('me/avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload an avatar image (PNG, JPEG, GIF or WebP)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: { avatar: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: UserDto })
  uploadAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedAvatar | undefined,
  ): Promise<UserDto> {
    return this.users.uploadAvatar(user.id, file);
  }

  @Delete('me/avatar')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove the current user’s avatar' })
  @ApiOkResponse({ type: UserDto })
  removeAvatar(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.users.removeAvatar(user.id);
  }

  /**
   * Public so `<img src>` works without a bearer token. Avatar URLs contain an
   * unguessable user id and a version, and only expose the image itself.
   */
  @Public()
  @Get(':userId/avatar')
  @Header('Cache-Control', 'public, max-age=1800')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  @ApiOperation({ summary: 'Redirect to a user’s avatar image' })
  @ApiFoundResponse({ description: 'Redirects to a short-lived image URL' })
  @ApiNotFoundResponse({ description: 'The user has no avatar' })
  async avatar(
    @Param('userId', uuidParam('Avatar')) userId: string,
    @Res() response: Response,
  ): Promise<void> {
    const url = await this.users.avatarDownloadUrl(userId);
    if (!url) throw Errors.notFound('Avatar');
    response.redirect(302, url);
  }
}
