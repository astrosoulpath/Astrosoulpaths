import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getPublicStats() {
    const now = new Date();

    const [
      verifiedAstrologers,
      registeredCustomers,
      totalConsultations,
      completedConsultations,
      activeConsultations,
      totalChatMessages,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({
        where: {
          isAstrologer: true,
          isActive: true,
          isBlocked: false,
        },
      }),

      this.prisma.user.count({
        where: {
          isAstrologer: false,
          isActive: true,
          isBlocked: false,
        },
      }),

      this.prisma.callSession.count(),

      this.prisma.callSession.count({
        where: {
          endedAt: {
            not: null,
          },
        },
      }),

      this.prisma.callSession.count({
        where: {
          status: 'ACTIVE',
          endedAt: null,
          expiresAt: {
            gt: now,
          },
        },
      }),

      this.prisma.chatMessage.count(),
    ]);

    return {
      success: true,

      message:
        'Public platform statistics fetched successfully',

      data: {
        verifiedAstrologers,
        registeredCustomers,
        totalConsultations,
        completedConsultations,
        activeConsultations,
        totalChatMessages,

        /*
         * Review module complete hone ke baad yahan
         * real average rating aur review count add hoga.
         */
        averageRating: null,
        totalReviews: 0,

        generatedAt:
          now.toISOString(),
      },
    };
  }

  async getAdminStats() {
    const now = new Date();

    const [
      totalUsers,
      activeUsers,
      blockedUsers,
      totalAstrologers,
      activeAstrologers,
      totalConsultations,
      activeConsultations,
      completedConsultations,
      totalMessages,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),

      this.prisma.user.count({
        where: {
          isActive: true,
          isBlocked: false,
        },
      }),

      this.prisma.user.count({
        where: {
          isBlocked: true,
        },
      }),

      this.prisma.user.count({
        where: {
          isAstrologer: true,
        },
      }),

      this.prisma.user.count({
        where: {
          isAstrologer: true,
          isActive: true,
          isBlocked: false,
        },
      }),

      this.prisma.callSession.count(),

      this.prisma.callSession.count({
        where: {
          status: 'ACTIVE',
          endedAt: null,
          expiresAt: {
            gt: now,
          },
        },
      }),

      this.prisma.callSession.count({
        where: {
          endedAt: {
            not: null,
          },
        },
      }),

      this.prisma.chatMessage.count(),
    ]);

    return {
      success: true,

      message:
        'Dashboard statistics fetched successfully',

      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          blocked: blockedUsers,
        },

        astrologers: {
          total: totalAstrologers,
          active: activeAstrologers,
        },

        consultations: {
          total: totalConsultations,
          active: activeConsultations,
          completed: completedConsultations,
        },

        chat: {
          totalMessages,
        },

        generatedAt:
          now.toISOString(),
      },
    };
  }
}