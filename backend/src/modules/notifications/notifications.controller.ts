import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthUser } from '../../common/auth/auth.types.js';
import { CurrentUser } from '../../common/auth/decorators.js';
import { uuidParam } from '../../common/pipes/uuid-param.pipe.js';
import type { CursorPage } from '../../common/utils/pagination.js';

import {
  NotificationDto,
  NotificationListQueryDto,
  NotificationPageDto,
  NotificationPreferencesDto,
  UnreadCountDto,
} from './dto/notification.dto.js';
import {
  NotificationPreferencesService,
  type NotificationPreferences,
} from './notification-preferences.service.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly preferences: NotificationPreferencesService,
  ) {}

  @Get('notifications')
  @ApiOperation({ summary: 'The current user’s notifications (newest first, cursor-paginated)' })
  @ApiOkResponse({ type: NotificationPageDto })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: NotificationListQueryDto,
  ): Promise<CursorPage<NotificationDto>> {
    return this.notifications.list(user.id, query);
  }

  @Get('notifications/unread-count')
  @ApiOperation({ summary: 'Number of unread notifications' })
  @ApiOkResponse({ type: UnreadCountDto })
  async unreadCount(@CurrentUser() user: AuthUser): Promise<UnreadCountDto> {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Post('notifications/read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark every notification as read' })
  @ApiNoContentResponse()
  markAllRead(@CurrentUser() user: AuthUser): Promise<void> {
    return this.notifications.markAllRead(user.id);
  }

  @Post('notifications/:notificationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiOkResponse({ type: NotificationDto })
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('notificationId', uuidParam('Notification')) id: string,
  ): Promise<NotificationDto> {
    return this.notifications.markRead(user.id, id);
  }

  @Get('users/me/notification-preferences')
  @ApiOperation({ summary: 'Notification channel preferences' })
  @ApiOkResponse({ type: NotificationPreferencesDto })
  getPreferences(@CurrentUser() user: AuthUser): Promise<NotificationPreferences> {
    return this.preferences.get(user.id);
  }

  @Put('users/me/notification-preferences')
  @ApiOperation({ summary: 'Replace notification channel preferences' })
  @ApiOkResponse({ type: NotificationPreferencesDto })
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() input: NotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    return this.preferences.update(user.id, input);
  }
}
