import { Injectable, NotFoundException } from '@nestjs/common';
import { DevicePlatform, Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveInternalUserId(externalUserId: string): Promise<string> {
    const normalizedExternalUserId = externalUserId?.trim();

    if (!normalizedExternalUserId) {
      throw new NotFoundException('Authenticated user account was not found');
    }

    // Canonical production identity:
    // Supabase JWT subject -> UserAuthIdentity -> ASP User.id.
    const identity = await this.prisma.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'supabase',
          providerUserId: normalizedExternalUserId,
        },
      },
      select: {
        userId: true,
      },
    });

    if (identity?.userId) {
      return identity.userId;
    }

    // Legacy fallback for accounts not yet backfilled into UserAuthIdentity.
    const legacyUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { supabaseId: normalizedExternalUserId },
          { id: normalizedExternalUserId },
        ],
      },
      select: {
        id: true,
      },
    });

    if (!legacyUser) {
      throw new NotFoundException('Authenticated user account was not found');
    }

    return legacyUser.id;
  }

  async registerDevice(params: {
    externalUserId: string;
    fcmToken: string;
    platform: DevicePlatform;
    deviceId?: string;
  }) {
    const userId = await this.resolveInternalUserId(params.externalUserId);

    const fcmToken = params.fcmToken.trim();
    const deviceId = params.deviceId?.trim() || null;

    const device = await this.prisma.pushDevice.upsert({
      where: {
        fcmToken,
      },
      update: {
        userId,
        platform: params.platform,
        deviceId,
        isActive: true,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        fcmToken,
        platform: params.platform,
        deviceId,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });

    return {
      success: true,
      data: {
        id: device.id,
        platform: device.platform,
        isActive: device.isActive,
        lastSeenAt: device.lastSeenAt,
      },
    };
  }

  async createForUser(params: {
    userId: string;
    title: string;
    body: string;
    type?: string;
    data?: Prisma.InputJsonValue;
  }) {
    return this.prisma.appNotification.create({
      data: {
        userId: params.userId,
        title: params.title.trim(),
        body: params.body.trim(),
        type: params.type?.trim() || null,
        data: params.data,
      },
    });
  }

  async getNotifications(externalUserId: string) {
    const userId = await this.resolveInternalUserId(externalUserId);

    const [items, unreadCount] = await this.prisma.$transaction([
      this.prisma.appNotification.findMany({
        where: {
          userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100,
        select: {
          id: true,
          title: true,
          body: true,
          type: true,
          data: true,
          isRead: true,
          readAt: true,
          createdAt: true,
        },
      }),
      this.prisma.appNotification.count({
        where: {
          userId,
          isRead: false,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        items,
        unreadCount,
      },
    };
  }

  async getUnreadCount(externalUserId: string) {
    const userId = await this.resolveInternalUserId(externalUserId);

    const unreadCount = await this.prisma.appNotification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return {
      success: true,
      data: {
        unreadCount,
      },
    };
  }

  async markAsRead(externalUserId: string, notificationId: string) {
    const userId = await this.resolveInternalUserId(externalUserId);

    const notification = await this.prisma.appNotification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
      select: {
        id: true,
        isRead: true,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification was not found');
    }

    if (!notification.isRead) {
      await this.prisma.appNotification.update({
        where: {
          id: notification.id,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    }

    return {
      success: true,
    };
  }

  async markAllAsRead(externalUserId: string) {
    const userId = await this.resolveInternalUserId(externalUserId);

    await this.prisma.appNotification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      success: true,
    };
  }
}

