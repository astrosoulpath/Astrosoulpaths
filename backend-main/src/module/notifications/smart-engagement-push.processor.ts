import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { NotificationsCampaignService } from './notifications.campaign.service';

type EngagementType =
  | 'love'
  | 'marriage'
  | 'career'
  | 'astrology_question';

type LocalTime = {
  date: string;
  hour: number;
  minute: number;
};

@Injectable()
export class SmartEngagementPushProcessor {
  private readonly logger = new Logger(SmartEngagementPushProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly campaignService: NotificationsCampaignService,
  ) {}

  @Cron('*/15 * * * *')
  async process(): Promise<void> {
    const now = new Date();

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        isBlocked: false,
        pushDevices: {
          some: {
            isActive: true,
          },
        },
      },
      select: {
        id: true,
        freeChatGrantedAt: true,
        freeChatUsedAt: true,
        freeChatMinutes: true,
        userProfile: {
          select: {
            timezone: true,
            timezoneName: true,
          },
        },
      },
    });

    for (const user of users) {
      try {
        if (!user.userProfile) {
          continue;
        }

        const local = this.resolveLocalTime(
          now,
          user.userProfile.timezoneName,
          user.userProfile.timezone,
        );

        await this.processUser(user, local);
      } catch (error) {
        this.logger.error(
          `Smart engagement push failed for user ${user.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  private async processUser(
    user: {
      id: string;
      freeChatGrantedAt: Date | null;
      freeChatUsedAt: Date | null;
      freeChatMinutes: number;
    },
    local: LocalTime,
  ): Promise<void> {
    // Seed uses the USER'S local calendar date.
    const seed = this.hash(`${user.id}:${local.date}`);

    // One variable daytime/evening slot in USER LOCAL TIME.
    // Possible hours: 10:00 through 20:45 local time.
    const hour = 10 + (seed % 11);
    const quarter = Math.floor(seed / 11) % 4;
    const minute = quarter * 15;

    if (local.hour !== hour) {
      return;
    }

    if (local.minute < minute || local.minute >= minute + 15) {
      return;
    }

    const sentKey =
      `notification:smart-engagement:sent:${user.id}:${local.date}`;

    const alreadySent = await this.redis.get(sentKey);
    if (alreadySent) {
      return;
    }

    const lockKey =
      `notification:smart-engagement:lock:${user.id}:${local.date}`;

    const locked = await this.redis.setNX(lockKey, '1', 20 * 60);
    if (!locked) {
      return;
    }

    const types: EngagementType[] = [
      'love',
      'career',
      'marriage',
      'astrology_question',
    ];

    const type = types[Math.floor(seed / 44) % types.length];

    const freeChatEligible =
      user.freeChatGrantedAt !== null &&
      user.freeChatUsedAt === null &&
      user.freeChatMinutes > 0;

    const campaign = this.buildCampaign(type, freeChatEligible);

    try {
      await this.campaignService.sendCampaignToUser(user.id, campaign);

      await this.redis.set(sentKey, '1', 36 * 60 * 60);
    } catch (error) {
      this.logger.error(
        `Unable to send smart engagement campaign to ${user.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private buildCampaign(
    type: EngagementType,
    freeChatEligible: boolean,
  ): {
    type: EngagementType;
    title: string;
    body: string;
  } {
    const freeSuffix = freeChatEligible
      ? ' Your First Chat is FREE!'
      : '';

    switch (type) {
      case 'love':
        return {
          type,
          title: '💞 A Love Insight Is Waiting',
          body:
            `Your relationship guidance may have something worth exploring today.${freeSuffix}`,
        };

      case 'career':
        return {
          type,
          title: '💼 Career Guidance for Today',
          body:
            `Explore what your astrology guidance suggests for your next move.${freeSuffix}`,
        };

      case 'marriage':
        return {
          type,
          title: '💍 Relationship Guidance',
          body:
            `Your relationship reading may offer a useful perspective today.${freeSuffix}`,
        };

      case 'astrology_question':
      default:
        return {
          type: 'astrology_question',
          title: '✨ A New Insight Is Waiting',
          body:
            `Have something on your mind? Explore your astrology guidance today.${freeSuffix}`,
        };
    }
  }

  private hash(value: string): number {
    let hash = 0;

    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }

    return hash;
  }

  private resolveLocalTime(
    now: Date,
    timezoneName?: string | null,
    timezone?: number | null,
  ): LocalTime {
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

        const read = (type: Intl.DateTimeFormatPartTypes): string =>
          parts.find((part) => part.type === type)?.value ?? '';

        const year = Number(read('year'));
        const month = Number(read('month'));
        const day = Number(read('day'));
        const hour = Number(read('hour'));
        const minute = Number(read('minute'));

        if (
          Number.isFinite(year) &&
          Number.isFinite(month) &&
          Number.isFinite(day) &&
          Number.isFinite(hour) &&
          Number.isFinite(minute)
        ) {
          return {
            date:
              `${String(year).padStart(4, '0')}-` +
              `${String(month).padStart(2, '0')}-` +
              `${String(day).padStart(2, '0')}`,
            hour,
            minute,
          };
        }
      } catch {
        // Invalid IANA timezone: fall through to numeric offset.
      }
    }

    const offsetHours =
      typeof timezone === 'number' && Number.isFinite(timezone)
        ? timezone
        : 0;

    const local = new Date(
      now.getTime() + offsetHours * 60 * 60 * 1000,
    );

    return {
      date: local.toISOString().slice(0, 10),
      hour: local.getUTCHours(),
      minute: local.getUTCMinutes(),
    };
  }
}
