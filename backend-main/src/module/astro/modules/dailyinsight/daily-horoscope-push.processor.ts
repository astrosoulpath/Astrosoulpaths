import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { SubscriptionStatus } from '@prisma/client';

import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { NotificationsPushService } from '../../../notifications/notifications.push.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { NakshatraDailyInsightService } from './dailyinsight.service';
import { requireHoroscopeLocale, validateHoroscopeText } from '../../../subscription/horoscope-localization';
import { durableHoroscopeEnabled, horoscopeOutboxEnabled, HoroscopeDurableStore, DurableReading } from '../../../subscription/horoscope-durable.store';
import {horoscopeReminderCopy} from '../../../subscription/horoscope-reminder-copy';

const DAILY_HOROSCOPE_PLAN_NAME = 'DAILY_HOROSCOPE_MONTHLY';

@Injectable()
export class DailyHoroscopePushProcessor {
  private readonly logger = new Logger(DailyHoroscopePushProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly dailyInsightService: NakshatraDailyInsightService,
    private readonly pushService: NotificationsPushService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('*/15 * * * *')
  async scheduledDailyHoroscopePushes(): Promise<void> {
    // Only the consent-aware durable pipeline may run automatically.
    if (!horoscopeOutboxEnabled()) return;
    await this.processDailyHoroscopePushes();
  }

  /** Internal compatibility helper, not a scheduled or HTTP entry point. */
  async processDailyHoroscopePushes(): Promise<void> {
    if(durableHoroscopeEnabled() && !horoscopeOutboxEnabled()) return;
    const now = new Date();

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        subscriptionStatus: {
          in: [SubscriptionStatus.ACTIVE],
        },
        startDate: {
          lte: now,
        },
        endDate: {
          gt: now,
        },
        subscriptionPlan: {
          name: DAILY_HOROSCOPE_PLAN_NAME,
          isActive: true,
        },
        user: {
          isActive: true,
          isBlocked: false,
          pushDevices: {
            some: {
              isActive: true,
            },
          },
        },
      },
      select: {
        user: {
          select: {
            id: true,
            supabaseId: true,
            userProfile: {
              select: {
                timezone: true,
                timezoneName: true,
                lang: true,
              },
            },
          },
        },
      },
    });

    for (const subscription of subscriptions) {
      const user = subscription.user;

      if (!user.supabaseId || !user.userProfile) {
        continue;
      }

      const local = this.resolveLocalTime(
        now,
        user.userProfile.timezoneName,
        user.userProfile.timezone,
      );

      // AstroTalk/AstroSage-style delivery:
      // send during customer's local morning hour.
      const isHoroscopeHour = local.hour === 8;

      if (!isHoroscopeHour) {
        continue;
      }
      const savedLanguage = user.userProfile.lang?.trim().toLowerCase();
      if (!savedLanguage) continue;
      let locale: string;
      try { locale = requireHoroscopeLocale(savedLanguage); } catch { continue; }
      if(horoscopeOutboxEnabled()) {
        const preferences=await this.prisma.$queryRaw<Array<{enabled:boolean}>>`SELECT "enabled" FROM public."HoroscopeNotificationPreference" WHERE "userId"=${user.id}`;
        if(preferences[0]?.enabled!==true) continue;
      }

      const deliveryKind = 'horoscope';

      const sentKey =
        `daily-horoscope:push:sent:${deliveryKind}:${user.id}:${local.date}:${locale}`;
      const alreadySent = await this.redis.get(sentKey);

      if (alreadySent) {
        continue;
      }

      const lockKey =
        `daily-horoscope:push:lock:${deliveryKind}:${user.id}:${local.date}:${locale}`;
      const lockOwner = randomUUID();
      const locked = await this.redis.setNX(lockKey, lockOwner, 20 * 60);

      if (!locked) {
        continue;
      }

      try {
        const horoscope =
          await this.dailyInsightService.getNakshatraDailyInsight(
            user.supabaseId,
            'today',
            locale,
          );

        const data = horoscope?.data as Record<string, unknown> | undefined;

        const ai =
          data?.ai && typeof data.ai === 'object'
            ? (data.ai as Record<string, unknown>)
            : undefined;

        const notificationTitle =
          typeof ai?.notificationTitle === 'string'
            ? ai.notificationTitle.trim()
            : '';

        const shortReading =
          typeof ai?.shortReading === 'string' ? ai.shortReading.trim() : '';

        const dailyAdvice =
          typeof ai?.dailyAdvice === 'string' ? ai.dailyAdvice.trim() : '';

        const lifeAreas =
          ai?.lifeAreas && typeof ai.lifeAreas === 'object'
            ? (ai.lifeAreas as Record<string, unknown>)
            : undefined;

        const careerInsight =
          typeof lifeAreas?.career === 'string'
            ? lifeAreas.career.trim()
            : '';

        const relationshipInsight =
          typeof lifeAreas?.relationships === 'string'
            ? lifeAreas.relationships.trim()
            : '';
        const body =
          this.buildNotificationBody(shortReading, dailyAdvice);
        const generation = data?.generation as { language?: { code?: string } } | undefined;
        if (generation?.language?.code !== locale) throw new Error('Horoscope locale mismatch');

        if (!notificationTitle || !body) {
          this.logger.warn(
            'daily_horoscope.push.localized_content_missing',
          );
          continue;
        }
        validateHoroscopeText(locale, [notificationTitle, body]);
        const entitled = await this.prisma.subscription.findFirst({ where: {
          userId: user.id, subscriptionStatus: { in: [SubscriptionStatus.ACTIVE] },
          startDate: { lte: new Date() }, endDate: { gt: new Date() },
          subscriptionPlan: { name: DAILY_HOROSCOPE_PLAN_NAME, isActive: true },
        }, select: { id: true,endDate:true } });
        if (!entitled) continue;
        if(horoscopeOutboxEnabled()) {
          const readingId=data?.durableReadingId;
          if(typeof readingId!=='string') throw new Error('Durable reading required');
          const readings=await this.prisma.$queryRaw<DurableReading[]>`SELECT * FROM public."PersonalizedHoroscopeReading" WHERE "id"=${readingId} AND "userId"=${user.id} AND "locale"=${locale} AND "state"='READY'`;
          if(!readings[0]) throw new Error('Durable reading unavailable');
          const devices=await this.prisma.pushDevice.findMany({where:{userId:user.id,isActive:true},select:{id:true}});
          await new HoroscopeDurableStore(this.prisma).enqueue({...readings[0],subscriptionId:entitled.id},devices.map(d=>d.id),new Date());
          continue; // Never send from both the scheduler and durable worker.
        }


        const notification = await this.notificationsService.createForUser({
          userId: user.id,
          title: notificationTitle,
          body,
          type: 'horoscope',
          data: {
            type: 'horoscope',
            screen: 'horoscope',
            day: 'today',
            targetDate: local.date,
            source: 'daily-horoscope-push',
            locale,
          },
        });

        const pushResult = await this.pushService.sendToUser(user.id, {
          ...horoscopeReminderCopy(locale),
          expiresAt:entitled.endDate??undefined,
          data: {
            type: 'horoscope',
            screen: 'horoscope',
            day: 'today',
            targetDate: local.date,
            notificationId: notification.id,
            source: 'daily-horoscope-push',
            locale,
            ownerId:user.id,
          },
        });

        if (pushResult.sent > 0) {
          await this.redis.set(sentKey, '1', 48 * 60 * 60);

          this.logger.log(
            'daily_horoscope.push.sent',
          );
        } else {
          this.logger.warn(
            `daily_horoscope.push.not_sent sent=${pushResult.sent} failed=${pushResult.failed}`,
          );
        }
      } catch (error) {
        this.logger.error(
          'daily_horoscope.push.failed generation_or_delivery_unavailable',
        );
      } finally {
        await this.redis.releaseLock(lockKey, lockOwner);
      }
    }
  }

  private buildNotificationBody(
    shortReading: string,
    dailyAdvice: string,
  ): string | null {
    const source = shortReading || dailyAdvice;

    if (!source) {
      return null;
    }

    const characters = Array.from(source);
    if (characters.length <= 150) {
      return source;
    }

    return `${characters.slice(0, 147).join('').trim()}...`;
  }

  private resolveLocalTime(
    now: Date,
    timezoneName?: string | null,
    timezone?: number | null,
  ): {
    date: string;
    hour: number;
    minute: number;
  } {
    const zone = timezoneName?.trim();

    if (zone) {
      try {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: zone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).formatToParts(now);

        const read = (type: string) =>
          parts.find((part) => part.type === type)?.value ?? '';

        const year = read('year');
        const month = read('month');
        const day = read('day');
        const hour = Number(read('hour'));
        const minute = Number(read('minute'));

        if (year && month && day && Number.isFinite(hour) && Number.isFinite(minute)) {
          return {
            date: `${year}-${month}-${day}`,
            hour,
            minute,
          };
        }
      } catch {
        // Fall through to numeric timezone offset.
      }
    }

    const offsetHours =
      typeof timezone === 'number' && Number.isFinite(timezone) ? timezone : 0;

    const local = new Date(now.getTime() + offsetHours * 60 * 60 * 1000);

    return {
      date: [
        local.getUTCFullYear(),
        String(local.getUTCMonth() + 1).padStart(2, '0'),
        String(local.getUTCDate()).padStart(2, '0'),
      ].join('-'),
      hour: local.getUTCHours(),
      minute: local.getUTCMinutes(),
    };
  }
}
