import { paymentWhere } from './admin-record-query';
import { astrologerWhere } from './admin-astrologer-query';
import { historyWhere } from '../consultation/history-query';
import { DEFAULT_PLATFORM_COMMISSION_PERCENT } from '../../common/finance/commission-policy';
import { commissionAuditEnabled } from '../../common/finance/consultation-financial-policy';
import { Injectable, NotFoundException } from '@nestjs/common';

import { PaymentStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { customerWhere } from './admin-customer-query';
import { financialReadModel } from './admin-financial-read-model';
import { configuredPaymentMode } from '../payments/payment-creation-command';

export type AdminPaginationParams = {
  page?: number;
  limit?: number;
};

export type AdminUserListParams = AdminPaginationParams & {
  search?: string;
  customerOnly?: boolean;
  status?: string;
};

export type AdminAstrologerListParams = AdminPaginationParams & {
  search?: string;
  approval?: 'ALL' | 'PENDING' | 'APPROVED';
  onlineOnly?: boolean;
};

export type AdminCallListParams = AdminPaginationParams & { search?: string; status?: string; mode?: string };

export type AdminPaymentListParams = AdminPaginationParams & {
  search?: string;
  status?: PaymentStatus;
};

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getFinanceOverview() {
    // Currency groups must never be summed together or labelled settled company cash.
    return this.prisma.$transaction(async (tx) => {
      const wallets = await tx.wallet.groupBy({ by: ['currency'],
        _sum: { balance: true, lockedBalance: true, paidBalance: true, freeBalance: true } });
      const earnings = await tx.astrologerEarning.groupBy({ by: ['currency', 'status'],
        _sum: { grossAmount: true, platformFee: true, netAmount: true }, _count: { id: true } });
      const payouts = await tx.astrologerPayout.groupBy({ by: ['currency', 'status'],
        _sum: { amount: true }, _count: { id: true } });
      const collections = await tx.paymentOrder.groupBy({ by: ['currency', 'status'],
        _sum: { amount: true }, _count: { id: true } });
      const audit = commissionAuditEnabled() ? {
        status: 'RECORDED',
        rows: await tx.$queryRaw<Array<{ id: string; previousPercent: Prisma.Decimal; newPercent: Prisma.Decimal; effectiveAt: Date }>>`
          SELECT "id", "previousPercent", "newPercent", "effectiveAt" FROM public."CommissionPolicyAudit" ORDER BY "effectiveAt" DESC, "id" DESC LIMIT 50`,
      } : { status: 'NOT_ACTIVATED', rows: [] };
      const diagnostics=await financialReadModel(tx);
      return { wallets, earnings, payouts, collections, audit, ...diagnostics,
        runtime:{configuredPaymentMode:configuredPaymentMode(),recordMode:'PER_ORDER_METADATA; HISTORICAL UNKNOWN IS NOT ASSUMED TEST'},
        settlement: { status: 'UNVERIFIED', reason: 'Provider bank settlement reconciliation is not recorded by this report.' },
        accountingBasis: 'RECORDED_BALANCES_AND_EARNINGS',
        warning: 'Gross earnings are recorded completed billings, not all accepted captures. Reversed earnings are shown separately; fees, taxes and chargebacks are not inferred.' };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

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

      this.prisma.paymentOrder.groupBy({
        by: ['currency'], orderBy: {currency:'asc'},
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

      this.prisma.paymentOrder.groupBy({
        by: ['currency'], orderBy: {currency:'asc'},
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

      this.prisma.wallet.groupBy({
        by: ['currency'], orderBy: {currency:'asc'},
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
        successfulOrders: successfulPaymentSummary.reduce((n, row) => n + (row._count!.id ?? 0), 0),
        successfulAmount: successfulPaymentSummary.length === 1 ? successfulPaymentSummary[0]._sum!.amount : null,
        successfulAmountByCurrency: successfulPaymentSummary.map(row => ({currency:row.currency,amount:row._sum!.amount})),
        averageSuccessfulAmount: successfulPaymentSummary.length === 1 ? successfulPaymentSummary[0]._avg!.amount : null,
        refundedOrders: refundedPaymentSummary.reduce((n, row) => n + (row._count!.id ?? 0), 0),
        refundedAmount: refundedPaymentSummary.length === 1 ? refundedPaymentSummary[0]._sum!.amount : null,
        refundedAmountByCurrency: refundedPaymentSummary.map(row => ({currency:row.currency,amount:row._sum!.amount})),
      },

      wallets: {
        totalWallets: walletSummary.reduce((n, row) => n + (row._count!.id ?? 0), 0),
        totalBalance: walletSummary.length === 1 ? walletSummary[0]._sum!.balance : null,
        totalBalanceByCurrency: walletSummary.map(row => ({currency:row.currency,amount:row._sum!.balance})),
        totalLockedBalance: walletSummary.length === 1 ? walletSummary[0]._sum!.lockedBalance : null,
        totalLockedBalanceByCurrency: walletSummary.map(row => ({currency:row.currency,amount:row._sum!.lockedBalance})),
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

    const where: Prisma.UserWhereInput = params.customerOnly ? customerWhere(search, params.status) : search
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
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true, email: true, phone: true, name: true,
          isActive: true, isBlocked: true, createdAt: true, updatedAt: true,
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
          userProfile: { select: { fullName: true, avatarUrl: true } },
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
    const where = astrologerWhere(params);

    const [items, total] = await Promise.all([
      this.prisma.astrologer.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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

    return this.prisma.$transaction(async (tx) => {
      const astrologer = await tx.astrologer.update({
        where: {
          id: astrologerId,
        },
        data: {
          isApproved: true,
          isVerified: true,
          isOnline: false,
        },
      });

      await tx.user.update({
        where: {
          id: astrologer.userId,
        },
        data: {
          isAstrologer: true,
        },
      });

      return tx.astrologer.findUniqueOrThrow({
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
        },
      });
    });
  }
  async rejectAstrologer(astrologerId: string) {
    await this.ensureAstrologerExists(astrologerId);

    return this.prisma.$transaction(async (tx) => {
      const astrologer = await tx.astrologer.update({
        where: {
          id: astrologerId,
        },
        data: {
          isApproved: false,
          isVerified: false,
          isOnline: false,
        },
      });

      await tx.user.update({
        where: {
          id: astrologer.userId,
        },
        data: {
          isAstrologer: false,
        },
      });

      return tx.astrologer.findUniqueOrThrow({
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
        },
      });
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

    const where = historyWhere(params, 'admin');
    const [items, total] = await Promise.all([
      this.prisma.callSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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

      this.prisma.callSession.count({ where }),
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

    const where = paymentWhere(params.search, params.status);

    const [items, total] = await Promise.all([
      this.prisma.paymentOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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

    const result = await this.prisma.paymentOrder.groupBy({
      by: ['currency'], orderBy: {currency:'asc'},
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
      successfulPayments: result.reduce((n,row) => n + (row._count!.id ?? 0), 0),
      collectionsByCurrency: result.map(row => ({currency:row.currency,amount:row._sum!.amount,average:row._avg!.amount,count:row._count!.id})),
      // Collections are not earned consultation commission or settled bank cash.
      successfulPaymentCollections: result.length === 1 ? result[0]._sum!.amount : null,
      accountingBasis: 'SUCCESSFUL_PAYMENT_COLLECTIONS' as const,
      // Retain the historical API key for compatibility; new consumers use the explicit key.
      totalRevenue: result.length === 1 ? result[0]._sum!.amount : null,
      averagePaymentAmount: result.length === 1 ? result[0]._avg!.amount : null,
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

  async getPlatformSettings() {
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'default' } });
    return settings ?? { id: 'default', platformCommissionPercent: new Prisma.Decimal(DEFAULT_PLATFORM_COMMISSION_PERCENT), updatedAt: null };
  }

  async updatePlatformSettings(platformCommissionPercent: number) {
    return this.prisma.platformSettings.upsert({
      where: {
        id: 'default',
      },
      update: {
        platformCommissionPercent: new Prisma.Decimal(
          platformCommissionPercent,
        ),
      },
      create: {
        id: 'default',
        platformCommissionPercent: new Prisma.Decimal(
          platformCommissionPercent,
        ),
      },
    });
  }
}
