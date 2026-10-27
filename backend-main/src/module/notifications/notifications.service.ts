import { Injectable, NotFoundException } from '@nestjs/common';
import { DevicePlatform, Prisma } from '@prisma/client';
import { BadRequestException, ServiceUnavailableException, Optional } from '@nestjs/common';
import { durableHoroscopeEnabled, horoscopeOutboxEnabled } from '../subscription/horoscope-durable.store';
import { DAILY_PLAN, assertDailyPlan } from '../subscription/daily-horoscope-policy';
import { NotificationsPushService } from './notifications.push.service';
import { validateHoroscopeText } from '../subscription/horoscope-localization';
import { notificationLocalDate } from './notification-local-date';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly push?: NotificationsPushService) {}

  async getExactReading(subject: string, readingId: string) {
    if (!durableHoroscopeEnabled()) throw new ServiceUnavailableException('Saved horoscope readings are not activated');
    if (!/^[a-f0-9]{64}$/.test(readingId)) throw new NotFoundException('Reading unavailable');
    const userId = await this.resolveInternalUserId(subject);
    const user = await this.prisma.user.findUnique({where:{id:userId},select:{isActive:true,isBlocked:true,userProfile:{select:{lang:true}}}});
    if (!user?.isActive || user.isBlocked) throw new NotFoundException('Reading unavailable');
    const rows = await this.prisma.$queryRaw<Array<{subscriptionId:string;locale:string;localDate:string;timezone:string;response:any}>>`
      SELECT "subscriptionId","locale","localDate"::text,"timezone","response" FROM public."PersonalizedHoroscopeReading"
      WHERE "id"=${readingId} AND "userId"=${userId} AND "state"='READY'`;
    const reading = rows[0];
    if (!reading || reading.locale !== user.userProfile?.lang?.trim().toLowerCase()) throw new NotFoundException('Reading unavailable');
    let currentDay: string;
    try { currentDay = notificationLocalDate(reading.timezone); }
    catch { throw new NotFoundException('Reading unavailable'); }
    if (reading.localDate !== currentDay) throw new NotFoundException('Reading unavailable');
    const now = new Date();
    const entitled = await this.prisma.subscription.findFirst({where:{id:reading.subscriptionId,userId,subscriptionStatus:'ACTIVE',startDate:{lte:now},endDate:{gt:now},subscriptionPlan:{name:DAILY_PLAN,isActive:true},user:{isActive:true,isBlocked:false}},select:{id:true}});
    if (!entitled) throw new NotFoundException('Reading unavailable');
    const ai = reading.response?.data?.ai;
    if (!ai || [ai.notificationTitle,ai.shortReading,ai.dailyAdvice].some(value=>typeof value!=='string' || !value.trim())) throw new NotFoundException('Reading unavailable');
    validateHoroscopeText(reading.locale,[ai.notificationTitle,ai.shortReading,ai.dailyAdvice]);
    return {success:true,data:{id:readingId,category:'daily',locale:reading.locale,date:reading.localDate,title:ai.notificationTitle,body:ai.shortReading,advice:ai.dailyAdvice,source:'PERSONALIZED_DAILY_HOROSCOPE',interpretationNotice:'Astrological interpretation is not a verified prediction.'}};
  }

  async getHoroscopePreference(subject:string) {
    if(!durableHoroscopeEnabled()) return {success:true,data:{enabled:false,status:'NOT_ACTIVATED',eligible:false,subscriptionStatus:'UNKNOWN',deliveryReady:false}};
    const userId=await this.resolveInternalUserId(subject);
    const rows=await this.prisma.$queryRaw<Array<{enabled:boolean}>>`SELECT "enabled" FROM public."HoroscopeNotificationPreference" WHERE "userId"=${userId}`;
    return {success:true,data:{enabled:rows[0]?.enabled===true,status:'RECORDED',...await this.horoscopeReminderEligibility(userId)}};
  }
  private async horoscopeReminderEligibility(userId:string) {
    const now=new Date();
    const active=await this.prisma.subscription.findFirst({where:{userId,subscriptionStatus:'ACTIVE',startDate:{lte:now},endDate:{gt:now},subscriptionPlan:{name:DAILY_PLAN,isActive:true},user:{isActive:true,isBlocked:false}},include:{subscriptionPlan:true}});
    let eligible=false;
    if(active?.subscriptionPlan) {try {assertDailyPlan(active.subscriptionPlan);eligible=true;}catch {/* Invalid pricing configuration never authorizes delivery. */}}
    const previous=active??await this.prisma.subscription.findFirst({where:{userId,subscriptionPlan:{name:DAILY_PLAN}},orderBy:{createdAt:'desc'},select:{subscriptionStatus:true,endDate:true}});
    const subscriptionStatus=eligible?'ACTIVE':previous?.endDate&&previous.endDate<=now?'EXPIRED':previous?'INACTIVE':'NONE';
    return {eligible,subscriptionStatus,expiresAt:eligible?active?.endDate?.toISOString()??null:null,deliveryReady:horoscopeOutboxEnabled()&&this.push?.isConfigured()===true};
  }
  async setHoroscopePreference(subject:string,enabled:unknown) {
    if(!durableHoroscopeEnabled()) throw new ServiceUnavailableException('Horoscope preferences are not activated');
    if(typeof enabled!=='boolean') throw new BadRequestException('Explicit notification consent is required');
    const userId=await this.resolveInternalUserId(subject);
    const eligibility=await this.horoscopeReminderEligibility(userId);
    if(enabled&&!eligibility.eligible) throw new BadRequestException('An active personalized horoscope subscription is required');
    await this.prisma.$executeRaw`INSERT INTO public."HoroscopeNotificationPreference" ("userId","enabled") VALUES (${userId},${enabled})
      ON CONFLICT ("userId") DO UPDATE SET "enabled"=${enabled},"updatedAt"=CURRENT_TIMESTAMP`;
    return {success:true,data:{enabled,status:'RECORDED',...eligibility}};
  }

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
    if (typeof params.fcmToken !== 'string' || !params.fcmToken.trim() || params.fcmToken.length > 4096 ||
        !Object.values(DevicePlatform).includes(params.platform) ||
        (params.deviceId != null && (typeof params.deviceId !== 'string' || params.deviceId.length > 256))) {
      throw new BadRequestException('Invalid notification device');
    }
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

  async unregisterDevice(subject:string,fcmToken:string) {
    if(typeof fcmToken!=='string'||!fcmToken.trim()) throw new BadRequestException('Device token is required');
    const userId=await this.resolveInternalUserId(subject);
    // A late logout from A must never deactivate a token already reassigned to B.
    await this.prisma.pushDevice.updateMany({where:{userId,fcmToken:fcmToken.trim()},data:{isActive:false}});
    return {success:true};
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

