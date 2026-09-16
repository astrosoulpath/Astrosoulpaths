import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SubscriptionStatus } from '@prisma/client';

import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { NotificationsPushService } from '../../../notifications/notifications.push.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { NakshatraDailyInsightService } from './dailyinsight.service';

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
  async processDailyHoroscopePushes(): Promise<void> {
    const now = new Date();

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        subscriptionStatus: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
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
      const isCategoryInsightHour = local.hour === 13;

      if (!isHoroscopeHour && !isCategoryInsightHour) {
        continue;
      }

      const deliveryKind =
        isHoroscopeHour ? 'horoscope' : 'category-insight';

      const sentKey =
        `daily-horoscope:push:sent:${deliveryKind}:${user.id}:${local.date}`;
      const alreadySent = await this.redis.get(sentKey);

      if (alreadySent) {
        continue;
      }

      const lockKey =
        `daily-horoscope:push:lock:${deliveryKind}:${user.id}:${local.date}`;
      const locked = await this.redis.setNX(lockKey, '1', 20 * 60);

      if (!locked) {
        continue;
      }

      try {
        const horoscope =
          await this.dailyInsightService.getNakshatraDailyInsight(
            user.supabaseId,
            'today',
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

        if (!notificationTitle || !body) {
          this.logger.warn(
            `daily_horoscope.push.localized_content_missing userId=${user.id}`,
          );
          continue;
        }

        if (isCategoryInsightHour) {
          const dateSeed = Number(
            local.date.replace(/-/g, '').slice(-6),
          );

          const categoryIndex =
            Math.abs(dateSeed + user.id.length) % 3;

          const category: 'love' | 'marriage' | 'career' =
            categoryIndex === 0
              ? 'love'
              : categoryIndex === 1
                ? 'marriage'
                : 'career';

          const personalizedInsight =
            category === 'career'
              ? careerInsight
              : relationshipInsight;

          if (!personalizedInsight) {
            this.logger.warn(
              `daily_category.push.personalized_content_missing userId=${user.id} type=${category}`,
            );
            continue;
          }

          const categoryTitle =
            category === 'love'
              ? 'Love & Relationship Insight'
              : category === 'marriage'
                ? 'Marriage Guidance'
                : 'Career Insight';

          const categoryBody =
            this.buildNotificationBody(
              personalizedInsight,
              personalizedInsight,
            ) ?? personalizedInsight;

          const categoryNotification =
            await this.notificationsService.createForUser({
              userId: user.id,
              title: categoryTitle,
              body: categoryBody,
              type: category,
              data: {
                type: category,
                screen: category,
                targetDate: local.date,
                personalized: true,
                source: 'daily-personalized-category',
              },
            });

          const categoryPush =
            await this.pushService.sendToUser(
              user.id,
              {
                title: categoryNotification.title,
                body: categoryNotification.body,
                data: {
                  type: category,
                  screen: category,
                  targetDate: local.date,
                  personalized: 'true',
                  notificationId: categoryNotification.id,
                  source: 'daily-personalized-category',
                },
              },
            );

          if (categoryPush.sent > 0) {
            await this.redis.set(
              sentKey,
              '1',
              48 * 60 * 60,
            );

            this.logger.log(
              `daily_category.push.sent userId=${user.id} type=${category} date=${local.date}`,
            );
          } else {
            this.logger.warn(
              `daily_category.push.not_delivered userId=${user.id} type=${category}`,
            );
          }

          continue;
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
          },
        });

        const pushResult = await this.pushService.sendToUser(user.id, {
          title: notification.title,
          body: notification.body,
          data: {
            type: 'horoscope',
            screen: 'horoscope',
            day: 'today',
            targetDate: local.date,
            notificationId: notification.id,
            source: 'daily-horoscope-push',
          },
        });

        if (pushResult.sent > 0) {
          await this.redis.set(sentKey, '1', 48 * 60 * 60);

          this.logger.log(
            `daily_horoscope.push.sent userId=${user.id} date=${local.date}`,
          );
        } else {
          this.logger.warn(
            `daily_horoscope.push.not_sent userId=${user.id} sent=${pushResult.sent} failed=${pushResult.failed}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `daily_horoscope.push.failed userId=${user.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
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

    if (source.length <= 150) {
      return source;
    }

    return `${source.substring(0, 147).trim()}...`;
  }

  private resolveLocalTime(
    now: Date,
    timezoneName?: string | null,
    timezone?: number | null,
  ): {
    date: string;
    hour: number;
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
          hourCycle: 'h23',
        }).formatToParts(now);

        const read = (type: string) =>
          parts.find((part) => part.type === type)?.value ?? '';

        const year = read('year');
        const month = read('month');
        const day = read('day');
        const hour = Number(read('hour'));

        if (year && month && day && Number.isFinite(hour)) {
          return {
            date: `${year}-${month}-${day}`,
            hour,
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
    };
  }
}
