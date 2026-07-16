import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export type AdminPaginationParams = {
  page?: number;
  limit?: number;
};

export type AdminUserListParams = AdminPaginationParams & {
  search?: string;
};

export type AdminAstrologerListParams = AdminPaginationParams & {
  search?: string;
  approval?: 'ALL' | 'PENDING' | 'APPROVED';
  onlineOnly?: boolean;
};

export type AdminCallListParams = AdminPaginationParams;

export type AdminPaymentListParams = AdminPaginationParams & {
  status?: PaymentStatus;
};

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getPagination(params: AdminPaginationParams = {}) {
    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);

    return {
      page,
      limit,
      skip: (page - 1) * limit,
    };
  }

  /*
   * ============================================================
   * ADMIN DASHBOARD
   * ============================================================
   */

  async getDashboardStats() {
    const [
      totalUsers,
      totalAstrologers,
      pendingAstrologers,
      approvedAstrologers,
      verifiedAstrologers,
      onlineAstrologers,
      totalCallSessions,
      totalPaymentOrders,
      successfulPaymentSummary,
      refundedPaymentSummary,
      walletSummary,
      totalReviews,
    ] = await Promise.all([
      this.prisma.user.count(),

      this.prisma.astrologer.count(),

      this.prisma.astrologer.count({
        where: {
          isApproved: false,
        },
      }),

      this.prisma.astrologer.count({
        where: {
          isApproved: true,
        },
      }),

      this.prisma.astrologer.count({
        where: {
          isVerified: true,
        },
      }),

      this.prisma.astrologer.count({
        where: {
          isOnline: true,
        },
      }),

      this.prisma.callSession.count(),

      this.prisma.paymentOrder.count(),

      this.prisma.paymentOrder.aggregate({
        where: {
          status: PaymentStatus.SUCCESS,
        },
        _count: {
          id: true,
        },
        _sum: {
          amount: true,
        },
        _avg: {
          amount: true,
        },
      }),

      this.prisma.paymentOrder.aggregate({
        where: {
          status: PaymentStatus.REFUNDED,
        },
        _count: {
          id: true,
        },
        _sum: {
          amount: true,
        },
      }),

      this.prisma.wallet.aggregate({
        _count: {
          id: true,
        },
        _sum: {
          balance: true,
          lockedBalance: true,
        },
      }),

      this.prisma.review.count(),
    ]);

    return {
      users: {
        total: totalUsers,
      },

      astrologers: {
        total: totalAstrologers,
        pending: pendingAstrologers,
        approved: approvedAstrologers,
        verified: verifiedAstrologers,
        online: onlineAstrologers,
      },

      consultations: {
        totalCallSessions,
      },

      payments: {
        totalOrders: totalPaymentOrders,
        successfulOrders: successfulPaymentSummary._count.id,
        successfulAmount: successfulPaymentSummary._sum.amount ?? 0,
        averageSuccessfulAmount:
          successfulPaymentSummary._avg.amount ?? 0,
        refundedOrders: refundedPaymentSummary._count.id,
        refundedAmount: refundedPaymentSummary._sum.amount ?? 0,
      },

      wallets: {
        totalWallets: walletSummary._count.id,
        totalBalance: walletSummary._sum.balance ?? 0,
        totalLockedBalance: walletSummary._sum.lockedBalance ?? 0,
      },

      reviews: {
        total: totalReviews,
      },
    };
  }

  /*
   * ============================================================
   * USER MANAGEMENT
   * ============================================================
   */

  async findUsers(params: AdminUserListParams = {}) {
    const { page, limit, skip } = this.getPagination(params);
    const search = params.search?.trim();

    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            {
              phone: {
                contains: search,
              },
            },
            {
              supabaseId: {
                contains: search,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          astrologer: {
            select: {
              id: true,
              isApproved: true,
              isVerified: true,
              isOnline: true,
              rating: true,
              pricePerMin: true,
            },
          },
          wallet: {
            select: {
              id: true,
              balance: true,
              lockedBalance: true,
              currency: true,
            },
          },
          userProfile: true,
        },
      }),

      this.prisma.user.count({
        where,
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        role: true,
        astrologer: {
          include: {
            expertise: {
              include: {
                expertise: true,
              },
            },
          },
        },
        wallet: true,
        userProfile: true,
        paymentOrders: {
          take: 10,
          orderBy: {
            createdAt: 'desc',
          },
        },
        calls: {
          take: 10,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /*
   * ============================================================
   * ASTROLOGER MANAGEMENT
   * ============================================================
   */

  async findAstrologers(params: AdminAstrologerListParams = {}) {
    const { page, limit, skip } = this.getPagination(params);
    const search = params.search?.trim();

    const where: Prisma.AstrologerWhereInput = {
      ...(params.approval === 'PENDING'
        ? {
            isApproved: false,
          }
        : {}),

      ...(params.approval === 'APPROVED'
        ? {
            isApproved: true,
          }
        : {}),

      ...(params.onlineOnly
        ? {
            isOnline: true,
          }
        : {}),

      ...(search
        ? {
            user: {
              is: {
                OR: [
                  {
                    phone: {
                      contains: search,
                    },
                  },
                  {
                    supabaseId: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                ],
              },
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.astrologer.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
              userProfile: true,
            },
          },
          expertise: {
            include: {
              expertise: true,
            },
          },
          _count: {
            select: {
              reviews: true,
              earnings: true,
              payouts: true,
            },
          },
        },
      }),

      this.prisma.astrologer.count({
        where,
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPendingAstrologers(limit = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 50);

    return this.prisma.astrologer.findMany({
      where: {
        isApproved: false,
      },
      take: safeLimit,
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        user: {
          include: {
            userProfile: true,
          },
        },
        expertise: {
          include: {
            expertise: true,
          },
        },
      },
    });
  }

  async findAstrologerById(astrologerId: string) {
    const astrologer = await this.prisma.astrologer.findUnique({
      where: {
        id: astrologerId,
      },
      include: {
        user: {
          include: {
            role: true,
            userProfile: true,
          },
        },
        expertise: {
          include: {
            expertise: true,
          },
        },
        reviews: {
          take: 20,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            user: true,
          },
        },
        earnings: {
          take: 20,
          orderBy: {
            createdAt: 'desc',
          },
        },
        payouts: {
          take: 20,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    return astrologer;
  }

  async approveAstrologer(astrologerId: string) {
    await this.ensureAstrologerExists(astrologerId);

    return this.prisma.astrologer.update({
      where: {
        id: astrologerId,
      },
      data: {
        isApproved: true,
        isVerified: true,
      },
      include: {
        user: {
          include: {
            role: true,
            userProfile: true,
          },
        },
        expertise: {
          include: {
            expertise: true,
          },
        },
      },
    });
  }

  async rejectAstrologer(astrologerId: string) {
    await this.ensureAstrologerExists(astrologerId);

    return this.prisma.astrologer.update({
      where: {
        id: astrologerId,
      },
      data: {
        isApproved: false,
        isVerified: false,
        isOnline: false,
      },
      include: {
        user: {
          include: {
            role: true,
            userProfile: true,
          },
        },
      },
    });
  }

  async verifyAstrologer(astrologerId: string) {
    await this.ensureAstrologerExists(astrologerId);

    return this.prisma.astrologer.update({
      where: {
        id: astrologerId,
      },
      data: {
        isVerified: true,
      },
    });
  }

  async suspendAstrologer(astrologerId: string) {
    await this.ensureAstrologerExists(astrologerId);

    return this.prisma.astrologer.update({
      where: {
        id: astrologerId,
      },
      data: {
        isApproved: false,
        isVerified: false,
        isOnline: false,
      },
    });
  }

  private async ensureAstrologerExists(astrologerId: string) {
    const astrologer = await this.prisma.astrologer.findUnique({
      where: {
        id: astrologerId,
      },
      select: {
        id: true,
      },
    });

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    return astrologer;
  }

  /*
   * ============================================================
   * CONSULTATION / CALL MANAGEMENT
   * ============================================================
   */

  async findCallSessions(params: AdminCallListParams = {}) {
    const { page, limit, skip } = this.getPagination(params);

    const [items, total] = await Promise.all([
      this.prisma.callSession.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            include: {
              userProfile: true,
            },
          },
          astrologer: {
            include: {
              userProfile: true,
            },
          },
          earning: true,
          _count: {
            select: {
              messages: true,
            },
          },
        },
      }),

      this.prisma.callSession.count(),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findCallSessionById(callSessionId: string) {
    const callSession = await this.prisma.callSession.findUnique({
      where: {
        id: callSessionId,
      },
      include: {
        user: {
          include: {
            userProfile: true,
          },
        },
        astrologer: {
          include: {
            userProfile: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        earning: true,
      },
    });

    if (!callSession) {
      throw new NotFoundException('Call session not found');
    }

    return callSession;
  }

  /*
   * ============================================================
   * PAYMENT MANAGEMENT
   * ============================================================
   */

  async findPaymentOrders(params: AdminPaymentListParams = {}) {
    const { page, limit, skip } = this.getPagination(params);

    const where: Prisma.PaymentOrderWhereInput = params.status
      ? {
          status: params.status,
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.paymentOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            include: {
              userProfile: true,
            },
          },
          wallet: true,
          kundliOrder: true,
        },
      }),

      this.prisma.paymentOrder.count({
        where,
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findPaymentOrderById(paymentOrderId: string) {
    const paymentOrder = await this.prisma.paymentOrder.findUnique({
      where: {
        id: paymentOrderId,
      },
      include: {
        user: {
          include: {
            userProfile: true,
          },
        },
        wallet: true,
        kundliOrder: true,
      },
    });

    if (!paymentOrder) {
      throw new NotFoundException('Payment order not found');
    }

    return paymentOrder;
  }

  async findRefundedPayments(params: AdminPaginationParams = {}) {
    const { page, limit, skip } = this.getPagination(params);

    const where: Prisma.PaymentOrderWhereInput = {
      status: PaymentStatus.REFUNDED,
    };

    const [items, total] = await Promise.all([
      this.prisma.paymentOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          updatedAt: 'desc',
        },
        include: {
          user: {
            include: {
              userProfile: true,
            },
          },
          wallet: true,
        },
      }),

      this.prisma.paymentOrder.count({
        where,
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRevenueSummary(startDate?: Date, endDate?: Date) {
    const createdAt: Prisma.DateTimeFilter | undefined =
      startDate || endDate
        ? {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          }
        : undefined;

    const result = await this.prisma.paymentOrder.aggregate({
      where: {
        status: PaymentStatus.SUCCESS,
        ...(createdAt ? { createdAt } : {}),
      },
      _count: {
        id: true,
      },
      _sum: {
        amount: true,
      },
      _avg: {
        amount: true,
      },
    });

    return {
      successfulPayments: result._count.id,
      totalRevenue: result._sum.amount ?? 0,
      averagePaymentAmount: result._avg.amount ?? 0,
    };
  }

  /*
   * ============================================================
   * WALLET MANAGEMENT
   * ============================================================
   */

  async findWallets(params: AdminPaginationParams = {}) {
    const { page, limit, skip } = this.getPagination(params);

    const [items, total] = await Promise.all([
      this.prisma.wallet.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            include: {
              userProfile: true,
            },
          },
          _count: {
            select: {
              ledgerEntries: true,
              paymentOrders: true,
            },
          },
        },
      }),

      this.prisma.wallet.count(),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findWalletLedger(params: AdminPaginationParams = {}) {
    const { page, limit, skip } = this.getPagination(params);

    const [items, total] = await Promise.all([
      this.prisma.walletLedger.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          wallet: true,
          user: {
            include: {
              userProfile: true,
            },
          },
        },
      }),

      this.prisma.walletLedger.count(),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}