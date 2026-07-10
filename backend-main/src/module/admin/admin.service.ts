import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [customers, pendingAstrologers, approvedAstrologers] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.astrologer.count({
          where: { isApproved: false },
        }),
        this.prisma.astrologer.count({
          where: { isApproved: true },
        }),
      ]);

    return {
      success: true,
      data: {
        customers,
        pendingAstrologers,
        approvedAstrologers,
        todayRevenue: 0,
      },
    };
  }

  async getAstrologers() {
    const astrologers = await this.prisma.astrologer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        expertise: {
          include: {
            expertise: true,
          },
        },
      },
    });

    return {
      success: true,
      data: astrologers,
    };
  }

  async approveAstrologer(id: string) {
    const astrologer = await this.prisma.astrologer.update({
      where: { id },
      data: {
        isApproved: true,
        isVerified: true,
      },
      include: {
        user: true,
        expertise: {
          include: {
            expertise: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Astrologer approved successfully',
      data: astrologer,
    };
  }

  async suspendAstrologer(id: string) {
    const astrologer = await this.prisma.astrologer.update({
      where: { id },
      data: {
        isApproved: false,
        isVerified: false,
      },
      include: {
        user: true,
        expertise: {
          include: {
            expertise: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Astrologer suspended successfully',
      data: astrologer,
    };
  }
}