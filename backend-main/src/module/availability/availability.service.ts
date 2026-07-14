import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Returns public availability information for an astrologer.
   */
  async getAvailability(
    astrologerId: string,
  ) {
    const normalizedAstrologerId =
      astrologerId.trim();

    if (!normalizedAstrologerId) {
      throw new NotFoundException(
        'Astrologer ID is required.',
      );
    }

    const astrologer =
      await this.prisma.astrologer.findFirst({
        where: {
          OR: [
            {
              id:
                normalizedAstrologerId,
            },
            {
              userId:
                normalizedAstrologerId,
            },
          ],

          isApproved:
            true,

          isVerified:
            true,

          user: {
            isActive:
              true,

            isBlocked:
              false,
          },
        },

        select: {
          id:
            true,

          userId:
            true,

          isOnline:
            true,

          updatedAt:
            true,

          user: {
            select: {
              name:
                true,

              avatarUrl:
                true,
            },
          },
        },
      });

    if (!astrologer) {
      throw new NotFoundException(
        'Astrologer not found.',
      );
    }

    return {
      success: true,

      message:
        'Astrologer availability fetched successfully.',

      data: {
        astrologerId:
          astrologer.userId,

        astrologerProfileId:
          astrologer.id,

        astrologerName:
          astrologer.user.name ??
          'Astro Soul Path Astrologer',

        avatarUrl:
          astrologer.user.avatarUrl,

        isOnline:
          astrologer.isOnline,

        responseTime:
          astrologer.isOnline
            ? 'Under 2 minutes'
            : null,

        availabilityText:
          astrologer.isOnline
            ? 'Available for consultation'
            : 'Currently offline',

        todaySchedule: {
          start:
            '10:00 AM',

          end:
            '08:00 PM',

          timezone:
            'Asia/Kolkata',
        },

        weeklyAvailability: [
          {
            day:
              'Monday',

            available:
              true,
          },
          {
            day:
              'Tuesday',

            available:
              true,
          },
          {
            day:
              'Wednesday',

            available:
              true,
          },
          {
            day:
              'Thursday',

            available:
              true,
          },
          {
            day:
              'Friday',

            available:
              true,
          },
          {
            day:
              'Saturday',

            available:
              true,
          },
          {
            day:
              'Sunday',

            available:
              false,
          },
        ],

        lastUpdated:
          astrologer.updatedAt,
      },
    };
  }
}