import { Global, Module } from '@nestjs/common';

import { NotificationDeliveryService } from './notification-delivery.service.js';
import { NotificationPreferencesService } from './notification-preferences.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationPreferencesService, NotificationDeliveryService],
  exports: [NotificationsService, NotificationPreferencesService, NotificationDeliveryService],
})
export class NotificationsModule {}
