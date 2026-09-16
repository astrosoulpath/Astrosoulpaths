import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsPushService } from './notifications.push.service';
import { NotificationsService } from './notifications.service';

type CampaignType =
  | 'love'
  | 'marriage'
  | 'career'
  | 'horoscope'
  | 'astrologer_online'
  | 'astrology_question';

type CampaignMessage = {
  type: CampaignType;
  title: string;
  body: string;
  astrologerId?: string;
  astrologerName?: string;
  astrologerAvatarUrl?: string;
};

@Injectable()
export class NotificationsCampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: NotificationsPushService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async sendCampaignToUser(userId: string, campaign: CampaignMessage) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        isBlocked: true,
      },
    });

    if (!user || !user.isActive || user.isBlocked) {
      return {
        success: true,
        skipped: true,
        reason: 'USER_NOT_ELIGIBLE',
      };
    }

    const campaignData = {
      type: campaign.type,
      screen: campaign.type,
      source: 'notification-campaign',
      ...(campaign.astrologerId ? { astrologerId: campaign.astrologerId } : {}),
      ...(campaign.astrologerName ? { astrologerName: campaign.astrologerName } : {}),
      ...(campaign.astrologerAvatarUrl
        ? { astrologerAvatarUrl: campaign.astrologerAvatarUrl }
        : {}),
    };
    const notification = await this.notificationsService.createForUser({
      userId: user.id,
      title: campaign.title,
      body: campaign.body,
      type: campaign.type,
      data: campaignData,
    });

    const push = await this.pushService.sendToUser(user.id, {
      title: notification.title,
      body: notification.body,
      data: {
        ...campaignData,
        notificationId: notification.id,
      },
    });

    return {
      success: true,
      skipped: false,
      notification,
      push,
    };
  }

  buildDefaultCampaign(type: CampaignType): CampaignMessage {
    switch (type) {
      case 'love':
        return {
          type,
          title: 'Love Insight',
          body: 'Your love life may be entering an important phase. Check your guidance.',
        };

      case 'marriage':
        return {
          type,
          title: 'Marriage Guidance',
          body: 'Your marriage-related planetary influences have new guidance for you.',
        };

      case 'career':
        return {
          type,
          title: 'Career Insight',
          body: 'A new career opportunity or decision may need your attention.',
        };

      case 'horoscope':
        return {
          type,
          title: 'Daily Horoscope',
          body: 'Your daily horoscope is ready. See what the stars indicate today.',
        };

      case 'astrologer_online':
        return {
          type,
          title: 'Astrologer Available',
          body: 'A verified astrologer is available now for consultation.',
        };

      case 'astrology_question':
        return {
          type,
          title: 'Ask the Stars',
          body: 'Have a question about love, career or marriage? Get astrology guidance now.',
        };
    }
  }
}

