import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request } from 'express';

import { NotificationsIdentityGuard } from './notifications-identity.guard';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';
import { NotificationsPushService } from './notifications.push.service';
import { NotificationsService } from './notifications.service';

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    id?: string;
  };
};

@Controller('notifications')
@UseGuards(NotificationsIdentityGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsPushService: NotificationsPushService,
  ) {}

  private externalUserId(request: AuthenticatedRequest): string {
    const externalUserId =
      request.user?.sub?.trim() || request.user?.id?.trim();

    if (!externalUserId) {
      throw new UnauthorizedException(
        'Authenticated user identity was not found',
      );
    }

    return externalUserId;
  }

  @Get()
  getNotifications(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.getNotifications(
      this.externalUserId(request),
    );
  }

  @Get('unread-count')
  getUnreadCount(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.getUnreadCount(
      this.externalUserId(request),
    );
  }

  @Get('readings/:readingId')
  getExactReading(@Req() request: AuthenticatedRequest, @Param('readingId') readingId: string) {
    return this.notificationsService.getExactReading(this.externalUserId(request), readingId);
  }

  @Get('horoscope-preference')
  getHoroscopePreference(@Req() request:AuthenticatedRequest) {
    return this.notificationsService.getHoroscopePreference(this.externalUserId(request));
  }
  @Patch('horoscope-preference')
  setHoroscopePreference(@Req() request:AuthenticatedRequest,@Body() body:{enabled?:unknown}) {
    return this.notificationsService.setHoroscopePreference(this.externalUserId(request),body.enabled);
  }

  @Patch('read-all')
  markAllAsRead(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.markAllAsRead(
      this.externalUserId(request),
    );
  }

  @Patch(':notificationId/read')
  markAsRead(
    @Req() request: AuthenticatedRequest,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(
      this.externalUserId(request),
      notificationId,
    );
  }

  @Post('test-push')
  async testPush(@Req() request: AuthenticatedRequest) {
    if (process.env.NODE_ENV === 'production' || process.env.NOTIFICATION_SELF_TEST_ENABLED !== 'true') {
      throw new ServiceUnavailableException('Notification self-test is disabled');
    }
    const externalUserId = this.externalUserId(request);

    const userId =
      await this.notificationsService.resolveInternalUserId(externalUserId);

    const notification = await this.notificationsService.createForUser({
      userId,
      title: 'Notification delivery test',
      body: 'This is a delivery test, not subscription activation.',
      type: 'delivery_test',
      data: {
        type: 'delivery_test',
      },
    });

    const pushResult = await this.notificationsPushService.sendToUser(userId, {
      title: notification.title,
      body: notification.body,
      data: {
        type: notification.type ?? 'delivery_test',
        screen: 'notifications',
        notificationId: notification.id,
      },
    });

    return {
      success: true,
      data: {
        notification,
        push: pushResult,
      },
    };
  }

  @Post('devices/register')
  registerDevice(
    @Req() request: AuthenticatedRequest,
    @Body() body: RegisterPushDeviceDto,
  ) {
    return this.notificationsService.registerDevice({
      externalUserId: this.externalUserId(request),
      fcmToken: body.fcmToken,
      platform: body.platform,
      deviceId: body.deviceId,
    });
  }

  @Post('devices/unregister')
  unregisterDevice(@Req() request:AuthenticatedRequest,@Body() body:{fcmToken?:unknown}) {
    return this.notificationsService.unregisterDevice(this.externalUserId(request),typeof body?.fcmToken==='string'?body.fcmToken:'');
  }
}
