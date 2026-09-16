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
} from '@nestjs/common';
import type { Request } from 'express';

import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
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
@UseGuards(SupabaseAuthGuard)
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
    const externalUserId = this.externalUserId(request);

    const userId =
      await this.notificationsService.resolveInternalUserId(externalUserId);

    const notification = await this.notificationsService.createForUser({
      userId,
      title: 'Astro Soul Path',
      body: 'Your notification system is ready.',
      type: 'astrology_question',
      data: {
        type: 'astrology_question',
      },
    });

    const pushResult = await this.notificationsPushService.sendToUser(userId, {
      title: notification.title,
      body: notification.body,
      data: {
        type: notification.type ?? 'general',
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
}
