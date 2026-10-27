import { historyWhere } from './history-query';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AstrologerEarningStatus,
  LedgerReferenceType,
  LedgerType,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { approvedReleaseAt, financialLifecycleEnabled, readFinancialPolicy, snapshotCommission } from '../../common/finance/consultation-financial-policy';

export type ConsultationPaginationParams = {
  page?: number;
  limit?: number;
  search?: string;
  mode?: string;
  status?: string;
};

export type CreateConsultationParams = {
  userId: string;

  /**
   * CallSession.astrologerId references the astrologer's User.id,
   * not Astrologer.id.
   */
  astrologerId: string;

  channelName: string;

  mode: 'chat' | 'audio' | 'video';

  ratePerMinute: number;
  purchasedMinutes: number;
  requireFreeChat?: boolean;
  amountCharged: number;
  startedAt: Date;
  expiresAt: Date;
  status: string;

  astrologyQuestionId?: string;
  astrologyQuestionText?: string;
  astrologyCategorySlug?: string;
};

export type ExtendConsultationParams = {
  additionalMinutes: number;
  additionalAmount: number;
  newExpiresAt: Date;
};

export type CompleteConsultationParams = {
  amountCharged: number;
  endedAt?: Date;
  status?: string;
  platformFeePercent: number;
};

@Injectable()
export class ConsultationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getPagination(params: ConsultationPaginationParams = {}) {
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
   * CREATE CONSULTATION + WALLET DEDUCTION
   * ============================================================
   */

  async createConsultation(params: CreateConsultationParams) {
    return this.prisma.$transaction(
      async (transaction) => {
        const now = new Date();
        const wantsFreeChat =
          params.mode === 'chat' && params.purchasedMinutes === 1;

        /*
         * Atomically claim the one-time free chat.
         * If anything later fails, the whole transaction rolls back.
         */
        const freeChatClaim = wantsFreeChat
          ? await transaction.user.updateMany({
              where: {
                id: params.userId,
                freeChatGrantedAt: {
                  not: null,
                },
                freeChatUsedAt: null,
                freeChatMinutes: {
                  gte: 1,
                },
              },
              data: {
                freeChatUsedAt: now,
              },
            })
          : { count: 0 };

        const isFreeChat = freeChatClaim.count === 1;
        // A racing/stale free-only request must never fall through to charging.
        if (params.requireFreeChat && !isFreeChat) {
          throw new ConflictException('Free chat is no longer available');
        }
        if (!isFreeChat && financialLifecycleEnabled()) approvedReleaseAt(now);

        const reservedAmount = this.toMoneyDecimal(
          isFreeChat ? 0 : params.amountCharged,
        );

        const existingUserConsultation =
          await transaction.callSession.findFirst({
            where: {
              userId: params.userId,
              endedAt: null,
              expiresAt: { gt: now },
            },
            select: { id: true },
          });

        if (existingUserConsultation) {
          throw new ConflictException(
            'You already have a pending or active consultation',
          );
        }

        const wallet = await transaction.wallet.upsert({
          where: { userId: params.userId },
          update: {},
          create: {
            userId: params.userId,
            currency: 'INR',
          },
        });

        // Consultation rates and settlement are INR. Never treat another
        // wallet currency's numeric balance as rupees or invent an FX charge.
        if (!isFreeChat && wallet.currency !== 'INR') {
          throw new BadRequestException('Paid consultations require an INR wallet');
        }
        const availableBalance = wallet.balance.minus(wallet.lockedBalance);

        if (availableBalance.lessThan(reservedAmount)) {
          throw new BadRequestException('INSUFFICIENT_BALANCE');
        }

        const consultation = await transaction.callSession.create({
          data: {
            userId: params.userId,
            astrologerId: params.astrologerId,
            channelName: params.channelName,
            mode: params.mode,
            ratePerMinute: params.ratePerMinute,
            purchasedMinutes: params.purchasedMinutes,
            extendedMinutes: 0,
            amountCharged: Number(reservedAmount.toString()),
            isFreeChat,
            startedAt: params.startedAt,
            expiresAt: params.expiresAt,
            astrologyQuestionId: params.astrologyQuestionId,
            astrologyQuestionText: params.astrologyQuestionText,
            astrologyCategorySlug: params.astrologyCategorySlug,
            status: params.status,
          },
        });

        if (!isFreeChat && financialLifecycleEnabled()) await snapshotCommission(transaction, consultation.id);
        const updatedWallet = isFreeChat ? wallet : await transaction.wallet.update({
          where: { id: wallet.id },
          data: {
            lockedBalance: wallet.lockedBalance.plus(reservedAmount),
          },
        });

        const populatedConsultation =
          await transaction.callSession.findUniqueOrThrow({
            where: { id: consultation.id },
            include: {
              user: { include: { userProfile: true } },
              astrologer: {
                include: { userProfile: true },
              },
              earning: true,
              _count: {
                select: { messages: true },
              },
            },
          });

        return {
          consultation: populatedConsultation,
          wallet: {
            id: updatedWallet.id,
            balance: Number(updatedWallet.balance.toString()),
            lockedBalance: Number(updatedWallet.lockedBalance.toString()),
            currency: updatedWallet.currency,
          },
          transaction: null,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  /*
   * ============================================================
   * CONSULTATION DETAILS
   * ============================================================
   */

  async findConsultationById(consultationId: string) {
    const consultation = await this.prisma.callSession.findUnique({
      where: {
        id: consultationId,
      },
      include: {
        user: {
          include: {
            userProfile: true,
            wallet: true,
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
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }

    return consultation;
  }

  /*
   * ============================================================
   * ACTIVE CONSULTATION
   * ============================================================
   */

  async findActiveUserConsultation(userId: string) {
    return this.prisma.callSession.findFirst({
      where: {
        OR: [
          {
            userId,
          },
          {
            user: {
              supabaseId: userId,
            },
          },
        ],
        endedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
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
    });
  }

  async findActiveAstrologerConsultation(astrologerUserId: string) {
    return this.prisma.callSession.findMany({
      where: {
        OR: [
          {
            astrologerId: astrologerUserId,
          },
          {
            astrologer: {
              supabaseId: astrologerUserId,
            },
          },
        ],
        endedAt: null,
        expiresAt: {
          gt: new Date(),
        },
        status: {
          in: ['ACTIVE', 'PENDING'],
        },
      },
      orderBy: [
        {
          status: 'asc',
        },
        {
          createdAt: 'asc',
        },
        {
          id: 'asc',
        },
      ],
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
    });
  }

  async hasActiveConsultation(userId: string, astrologerUserId?: string) {
    const count = await this.prisma.callSession.count({
      where: {
        userId,

        ...(astrologerUserId
          ? {
              astrologerId: astrologerUserId,
            }
          : {}),

        endedAt: null,

        expiresAt: {
          gt: new Date(),
        },
      },
    });

    return count > 0;
  }

  /*
   * ============================================================
   * CUSTOMER CONSULTATION HISTORY
   * ============================================================
   */

  /** Read-only all-history dashboard totals; never reserve or settle funds. */
  async customerDashboardSummary(userId: string) {
    if (!userId?.trim()) throw new BadRequestException('Customer ID required');
    const finished = { userId, status: { in: ['COMPLETED', 'ENDED'] } };
    const [active, completed, spend] = await this.prisma.$transaction([
      this.prisma.callSession.count({ where: { userId, status: 'ACTIVE', endedAt: null, expiresAt: { gt: new Date() } } }),
      this.prisma.callSession.count({ where: finished }),
      this.prisma.callSession.aggregate({ where: finished, _sum: { amountCharged: true } }),
    ]);
    return { active, completed, recordedSpend: spend._sum.amountCharged ?? 0, currency: 'INR' };
  }

  async findUserConsultationHistory(
    userId: string,
    params: ConsultationPaginationParams = {},
  ) {
    const { page, limit, skip } = this.getPagination(params);

    const where: Prisma.CallSessionWhereInput = {
      ...historyWhere(params, 'customer'),
      userId,
    };

    const [items, total] = await Promise.all([
      this.prisma.callSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          astrologer: {
            select: {
              id: true, name: true,
              userProfile: { select: { fullName: true, avatarUrl: true } },
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

      this.prisma.callSession.count({
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

  /*
   * ============================================================
   * ASTROLOGER CONSULTATION HISTORY
   * ============================================================
   */

  async findAstrologerConsultationHistory(
    astrologerUserId: string,
    params: ConsultationPaginationParams = {},
  ) {
    const { page, limit, skip } = this.getPagination(params);

    if ([params.search, params.mode, params.status].some(value => value !== undefined && typeof value !== 'string')) {
      throw new BadRequestException('Invalid history filters');
    }
    const search = params.search?.trim() ?? '';
    const mode = params.mode?.trim().toLowerCase() ?? '';
    const status = params.status?.trim().toUpperCase() ?? '';
    if (search.length > 100 || (mode && !['chat', 'audio', 'video'].includes(mode)) ||
        (status && !['PENDING', 'ACTIVE', 'COMPLETED', 'ENDED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(status))) {
      throw new BadRequestException('Invalid history filters');
    }

    const where: Prisma.CallSessionWhereInput = {
      astrologerId: astrologerUserId,
      ...(mode ? { mode: { equals: mode, mode: 'insensitive' } } : {}),
      ...(status ? { status: { equals: status, mode: 'insensitive' } } : {}),
      ...(search ? { user: { OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { userProfile: { fullName: { contains: search, mode: 'insensitive' } } },
      ] } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.callSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true, userId: true, mode: true, status: true,
          createdAt: true, startedAt: true, endedAt: true, expiresAt: true,
          amountCharged: true, ratePerMinute: true, purchasedMinutes: true,
          extendedMinutes: true, isFreeChat: true,
          user: {
            select: {
              id: true, name: true,
              userProfile: { select: { fullName: true } },
            },
          },
          earning: { select: { netAmount: true, currency: true, status: true } },
          _count: {
            select: {
              messages: true,
            },
          },
        },
      }),

      this.prisma.callSession.count({
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

  /*
   * ============================================================
   * LATEST CONSULTATION
   * ============================================================
   */

  async findLatestUserConsultation(userId: string) {
    return this.prisma.callSession.findFirst({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
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
    });
  }

  async findLatestAstrologerConsultation(astrologerUserId: string) {
    return this.prisma.callSession.findFirst({
      where: {
        astrologerId: astrologerUserId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
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
    });
  }

  /*
   * ============================================================
   * ASTROLOGER AVAILABILITY
   * ============================================================
   */

  async findAvailableAstrologerByUserId(astrologerUserId: string) {
    return this.prisma.astrologer.findFirst({
      where: {
        userId: astrologerUserId,
        isApproved: true,
        isVerified: true,
        isOnline: true,
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

  async findAstrologerByUserId(astrologerUserId: string) {
    const astrologer = await this.prisma.astrologer.findUnique({
      where: {
        userId: astrologerUserId,
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

    if (!astrologer) {
      throw new NotFoundException('Astrologer not found');
    }

    return astrologer;
  }

  /*
   * ============================================================
   * WALLET
   * ============================================================
   */

  async findUserWallet(userId: string) {
    return this.prisma.wallet.findUnique({
      where: {
        userId,
      },
    });
  }

  async findUserWalletOrThrow(userId: string) {
    const wallet = await this.findUserWallet(userId);

    if (!wallet) {
      throw new NotFoundException('User wallet not found');
    }

    return wallet;
  }

  /*
   * ============================================================
   * ACCEPT PENDING CONSULTATION
   * ============================================================
   */

  async acceptConsultation(consultationId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        const consultation = await transaction.callSession.findUnique({
          where: { id: consultationId },
        });

        if (!consultation) {
          throw new NotFoundException('Consultation not found');
        }

        if (consultation.endedAt) {
          throw new ConflictException('Consultation has already ended');
        }

        if (consultation.status.toUpperCase() !== 'PENDING') {
          throw new ConflictException(
            'Only a pending consultation can be accepted',
          );
        }

        const queueNow = new Date();

        const activeAstrologerConsultation =
          await transaction.callSession.findFirst({
            where: {
              astrologerId: consultation.astrologerId,
              id: {
                not: consultation.id,
              },
              status: 'ACTIVE',
              endedAt: null,
              expiresAt: {
                gt: queueNow,
              },
            },
            select: {
              id: true,
            },
          });

        if (activeAstrologerConsultation) {
          throw new ConflictException(
            'The astrologer is currently busy with another active consultation',
          );
        }

        const firstPendingConsultation =
          await transaction.callSession.findFirst({
            where: {
              astrologerId: consultation.astrologerId,
              status: 'PENDING',
              endedAt: null,
              expiresAt: {
                gt: queueNow,
              },
            },
            orderBy: [
              {
                createdAt: 'asc',
              },
              {
                id: 'asc',
              },
            ],
            select: {
              id: true,
            },
          });

        if (
          !firstPendingConsultation ||
          firstPendingConsultation.id !== consultation.id
        ) {
          throw new ConflictException(
            'Another customer is ahead in the consultation queue',
          );
        }

        const wallet = await transaction.wallet.findUnique({
          where: { userId: consultation.userId },
        });

        if (!wallet) {
          throw new NotFoundException('User wallet not found');
        }

        const chargeAmount = this.toMoneyDecimal(consultation.amountCharged);
        if (consultation.isFreeChat && !chargeAmount.isZero()) {
          throw new ConflictException('Free consultation has an inconsistent charge');
        }

        if (wallet.lockedBalance.lessThan(chargeAmount)) {
          throw new ConflictException(
            'Reserved wallet amount is no longer available',
          );
        }

        if (wallet.balance.lessThan(chargeAmount)) {
          throw new BadRequestException('INSUFFICIENT_BALANCE');
        }

        const startedAt = new Date();
        const totalMinutes =
          consultation.purchasedMinutes + consultation.extendedMinutes;
        const expiresAt = new Date(startedAt.getTime() + totalMinutes * 60_000);

        const balanceBefore = wallet.balance;
        const balanceAfter = balanceBefore.minus(chargeAmount);
        const lockedBalanceAfter = wallet.lockedBalance.minus(chargeAmount);

        const updatedConsultation = await transaction.callSession.update({
          where: { id: consultationId },
          data: {
            status: 'ACTIVE',
            startedAt,
            expiresAt,
          },
        });

        const updatedWallet = consultation.isFreeChat ? wallet : await transaction.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: balanceAfter,
            lockedBalance: lockedBalanceAfter,
          },
        });

        const ledgerEntry = consultation.isFreeChat
          ? null
          : await transaction.walletLedger.create({
              data: {
                walletId: wallet.id,
                userId: consultation.userId,
                type: LedgerType.CALL_DEDUCTION,
                amount: chargeAmount,
                balanceBefore,
                balanceAfter,
                referenceType: LedgerReferenceType.CALL_SESSION,
                referenceId: consultation.id,
                description: `${consultation.purchasedMinutes}-minute consultation accepted`,
              },
            });

        const populatedConsultation =
          await transaction.callSession.findUniqueOrThrow({
            where: { id: updatedConsultation.id },
            include: {
              user: { include: { userProfile: true } },
              astrologer: {
                include: { userProfile: true },
              },
              earning: true,
              _count: {
                select: { messages: true },
              },
            },
          });

        return {
          consultation: populatedConsultation,
          wallet: {
            id: updatedWallet.id,
            balance: Number(updatedWallet.balance.toString()),
            lockedBalance: Number(updatedWallet.lockedBalance.toString()),
            currency: updatedWallet.currency,
          },
          transaction: ledgerEntry
            ? {
                id: ledgerEntry.id,
                amount: Number(ledgerEntry.amount.toString()),
                balanceBefore: Number(ledgerEntry.balanceBefore.toString()),
                balanceAfter: Number(ledgerEntry.balanceAfter.toString()),
              }
            : null,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  /*
   * ============================================================
   * RELEASE PENDING CONSULTATION RESERVATION
   * ============================================================
   */

  async rejectConsultation(consultationId: string) {
    return this.cancelConsultation(consultationId, 'REJECTED');
  }

  /*
   * ============================================================
   * EXTEND CONSULTATION + WALLET DEDUCTION
   * ============================================================
   */

  async extendConsultation(
    consultationId: string,
    params: ExtendConsultationParams,
  ) {
    const additionalAmount = this.toMoneyDecimal(params.additionalAmount);

    return this.prisma.$transaction(
      async (transaction) => {
        const consultation = await transaction.callSession.findUnique({
          where: {
            id: consultationId,
          },
        });

        if (!consultation) {
          throw new NotFoundException('Consultation not found');
        }

        const normalizedStatus = consultation.status.toUpperCase();

        if (consultation.endedAt || normalizedStatus !== 'ACTIVE') {
          throw new ConflictException(
            'Only an active consultation can be extended',
          );
        }

        if (consultation.isFreeChat) {
          throw new ConflictException('Free chat cannot be extended into a paid consultation');
        }

        const wallet = await transaction.wallet.findUnique({
          where: {
            userId: consultation.userId,
          },
        });

        if (!wallet) {
          throw new NotFoundException('User wallet not found');
        }

        const availableBalance = wallet.balance.minus(wallet.lockedBalance);

        if (availableBalance.lessThan(additionalAmount)) {
          throw new BadRequestException('INSUFFICIENT_BALANCE');
        }

        const balanceBefore = wallet.balance;
        const balanceAfter = balanceBefore.minus(additionalAmount);

        const updatedConsultation = await transaction.callSession.update({
          where: {
            id: consultationId,
          },
          data: {
            extendedMinutes: {
              increment: params.additionalMinutes,
            },

            amountCharged: {
              increment: params.additionalAmount,
            },

            expiresAt: params.newExpiresAt,
          },
        });

        const updatedWallet = await transaction.wallet.update({
          where: {
            id: wallet.id,
          },
          data: {
            balance: balanceAfter,
          },
        });

        const ledgerEntry = await transaction.walletLedger.create({
          data: {
            walletId: wallet.id,
            userId: consultation.userId,
            type: LedgerType.CALL_DEDUCTION,
            amount: additionalAmount,
            balanceBefore,
            balanceAfter,
            referenceType: LedgerReferenceType.CALL_SESSION,
            referenceId: consultation.id,
            description: `${params.additionalMinutes}-minute consultation extension`,
          },
        });

        const populatedConsultation =
          await transaction.callSession.findUniqueOrThrow({
            where: {
              id: updatedConsultation.id,
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
          });

        return {
          consultation: populatedConsultation,

          wallet: {
            id: updatedWallet.id,
            balance: Number(updatedWallet.balance.toString()),
            lockedBalance: Number(updatedWallet.lockedBalance.toString()),
            currency: updatedWallet.currency,
          },

          transaction: {
            id: ledgerEntry.id,
            amount: Number(ledgerEntry.amount.toString()),
            balanceBefore: Number(ledgerEntry.balanceBefore.toString()),
            balanceAfter: Number(ledgerEntry.balanceAfter.toString()),
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  /*
   * ============================================================
   * CANCEL CONSULTATION
   * ============================================================
   */

  async cancelConsultation(consultationId: string, status = 'CANCELLED') {
    return this.prisma.$transaction(
      async (transaction) => {
        const consultation = await transaction.callSession.findUnique({
          where: { id: consultationId },
        });

        if (!consultation) {
          throw new NotFoundException('Consultation not found');
        }

        if (consultation.endedAt) {
          throw new ConflictException('Consultation has already ended');
        }

        const normalizedStatus = consultation.status.toUpperCase();

        if (normalizedStatus !== 'PENDING') {
          throw new ConflictException(
            'Only a pending consultation can be cancelled or rejected',
          );
        }

        const wallet = await transaction.wallet.findUnique({
          where: { userId: consultation.userId },
        });

        if (!wallet) {
          throw new NotFoundException('User wallet not found');
        }

        const reservedAmount = this.toMoneyDecimal(consultation.amountCharged);
        if (consultation.isFreeChat && !reservedAmount.isZero()) {
          throw new ConflictException('Free consultation has an inconsistent reservation');
        }

        const lockedBalanceAfter = wallet.lockedBalance.greaterThanOrEqualTo(
          reservedAmount,
        )
          ? wallet.lockedBalance.minus(reservedAmount)
          : new Prisma.Decimal(0);

        if (!consultation.isFreeChat) await transaction.wallet.update({
          where: { id: wallet.id },
          data: {
            lockedBalance: lockedBalanceAfter,
          },
        });

        await transaction.callSession.update({
          where: {
            id: consultationId,
          },
          data: {
            status,
            endedAt: new Date(),
          },
        });
        if (consultation.isFreeChat) {
          await transaction.user.update({
            where: {
              id: consultation.userId,
            },
            data: {
              freeChatUsedAt: null,
            },
          });
        }

        return transaction.callSession.findUniqueOrThrow({
          where: { id: consultationId },
          include: {
            user: { include: { userProfile: true } },
            astrologer: {
              include: { userProfile: true },
            },
            earning: true,
            _count: {
              select: { messages: true },
            },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  /*
   * ============================================================
   * COMPLETE CONSULTATION + ASTROLOGER SETTLEMENT
   * ============================================================
   */

  async completeConsultation(
    consultationId: string,
    params: CompleteConsultationParams,
  ) {
    let platformFeePercent = params.platformFeePercent;

    if (
      !Number.isFinite(platformFeePercent) ||
      platformFeePercent < 0 ||
      platformFeePercent > 100
    ) {
      throw new BadRequestException(
        'Platform fee percentage must be between 0 and 100',
      );
    }

    const grossAmount = this.toMoneyDecimal(params.amountCharged);

    return this.prisma.$transaction(
      async (transaction) => {
        const consultation = await transaction.callSession.findUnique({
          where: {
            id: consultationId,
          },
        });

        if (!consultation) {
          throw new NotFoundException('Consultation not found');
        }

        // Free completion has no commission, earning, wallet or payout posting.
        // Preserve historical entries: inconsistent existing earnings require review.
        if (consultation.isFreeChat) {
          if (consultation.endedAt && consultation.status.toUpperCase() === 'COMPLETED') {
            return transaction.callSession.findUniqueOrThrow({ where: { id: consultationId }, include: {
              user: { include: { userProfile: true } }, astrologer: { include: { userProfile: true } },
              earning: true, _count: { select: { messages: true } },
            } });
          }
          if (consultation.endedAt || consultation.status.toUpperCase() !== 'ACTIVE' ||
              !grossAmount.isZero() || !new Prisma.Decimal(consultation.amountCharged).isZero()) {
            throw new ConflictException('Free consultation cannot create paid earnings or settle inactive sessions');
          }
          if (await transaction.astrologerEarning.findUnique({ where: { callSessionId: consultationId } })) {
            throw new ConflictException('Existing earning requires reconciliation');
          }
          await transaction.callSession.update({ where: { id: consultationId }, data: {
            status: params.status ?? 'COMPLETED', endedAt: params.endedAt ?? new Date(),
          } });
          return transaction.callSession.findUniqueOrThrow({ where: { id: consultationId }, include: {
            user: { include: { userProfile: true } }, astrologer: { include: { userProfile: true } },
            earning: true, _count: { select: { messages: true } },
          } });
        }
        const policy = await readFinancialPolicy(transaction, consultationId);
        if (policy) platformFeePercent = Number(policy.platformPercent);
        const normalizedStatus = consultation.status.toUpperCase();

        if (consultation.endedAt && normalizedStatus === 'COMPLETED') {
          return transaction.callSession.findUniqueOrThrow({
            where: {
              id: consultationId,
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
          });
        }

        if (normalizedStatus !== 'ACTIVE') {
          throw new ConflictException(
            'Only an active consultation can be completed',
          );
        }

        // Fail closed on stale completion amounts and inconsistent historical state.
        if (!grossAmount.eq(new Prisma.Decimal(consultation.amountCharged))) {
          throw new ConflictException('Consultation amount changed; refresh before completion');
        }
        const existingEarning = await transaction.astrologerEarning.findUnique({ where: { callSessionId: consultationId } });
        if (existingEarning) throw new ConflictException('Existing earning requires reconciliation');
        if (consultation.isFreeChat) {
          if (!grossAmount.isZero()) throw new ConflictException('Free consultation cannot create paid earnings');
        } else {
          const entries = await transaction.walletLedger.findMany({ where: {
            userId: consultation.userId, referenceType: LedgerReferenceType.CALL_SESSION,
            referenceId: consultationId, type: { in: [LedgerType.CALL_DEDUCTION, LedgerType.REFUND] },
          } });
          let debited = new Prisma.Decimal(0);
          for (const entry of entries) {
            const amount = new Prisma.Decimal(entry.amount).abs();
            if (entry.type === LedgerType.REFUND || amount.lte(0) ||
                !new Prisma.Decimal(entry.balanceBefore).minus(entry.balanceAfter).eq(amount)) {
              throw new ConflictException('Consultation charge requires reconciliation');
            }
            debited = debited.plus(amount);
          }
          if (grossAmount.lte(0) || !debited.eq(grossAmount)) {
            throw new ConflictException('Verified consultation charge is required');
          }
        }

        const astrologer = await transaction.astrologer.findUnique({
          where: {
            userId: consultation.astrologerId,
          },
          select: {
            id: true,
          },
        });

        if (!astrologer) {
          throw new NotFoundException('Astrologer profile not found');
        }

        const platformFee = grossAmount
          .mul(platformFeePercent)
          .div(100)
          .toDecimalPlaces(2);

        const netAmount = grossAmount.minus(platformFee);
        const completedAt = params.endedAt ?? new Date();
        const availableAt = policy ? approvedReleaseAt(completedAt) : new Date();

        await transaction.callSession.update({
          where: {
            id: consultationId,
          },
          data: {
            amountCharged: Number(grossAmount.toString()),

            endedAt: params.endedAt ?? new Date(),

            status: params.status ?? 'COMPLETED',
          },
        });

        await transaction.astrologerEarning.upsert({
          where: {
            callSessionId: consultationId,
          },

          update: {
            grossAmount,
            platformFee,
            platformFeePercent: new Prisma.Decimal(platformFeePercent),
            netAmount,
            currency: 'INR',
            status: AstrologerEarningStatus.PENDING,
            availableAt,
            paidAt: null,
            reversedAt: null,
          },

          create: {
            astrologerId: astrologer.id,
            callSessionId: consultationId,
            grossAmount,
            platformFee,
            platformFeePercent: new Prisma.Decimal(platformFeePercent),
            netAmount,
            currency: 'INR',
            status: AstrologerEarningStatus.PENDING,
            availableAt,
          },
        });

        return transaction.callSession.findUniqueOrThrow({
          where: {
            id: consultationId,
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
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  /*
   * ============================================================
   * REVIEW / RATING
   * ============================================================
   */

  async hasConsultationReview(callSessionId: string) {
    const review = await this.prisma.review.findUnique({
      where: {
        callSessionId,
      },
      select: {
        id: true,
      },
    });

    return Boolean(review);
  }

  async createReview(params: {
    userId: string;
    astrologerId: string;
    callSessionId: string;
    rating: number;
    comment?: string;
  }) {
    return this.prisma.review.create({
      data: {
        userId: params.userId,
        astrologerId: params.astrologerId,
        callSessionId: params.callSessionId,
        rating: params.rating,
        comment: params.comment,
      },
      include: {
        user: true,
        astrologer: true,
      },
    });
  }

  async getAstrologerRatingSummary(astrologerId: string) {
    return this.prisma.review.aggregate({
      where: {
        astrologerId,
      },
      _count: {
        id: true,
      },
      _avg: {
        rating: true,
      },
    });
  }

  async updateAstrologerRating(
    astrologerId: string,
    rating: number,
    totalReviews: number,
  ) {
    return this.prisma.astrologer.update({
      where: {
        id: astrologerId,
      },
      data: {
        rating,
        totalReviews,
      },
    });
  }

  /*
   * ============================================================
   * HELPERS
   * ============================================================
   */

  async getConsultationQueuePosition(consultationId: string) {
    const consultation = await this.prisma.callSession.findUnique({
      where: {
        id: consultationId,
      },
      select: {
        id: true,
        astrologerId: true,
        status: true,
        endedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }

    const status = consultation.status.toUpperCase();
    const now = new Date();

    if (
      status !== 'PENDING' ||
      consultation.endedAt ||
      consultation.expiresAt.getTime() <= now.getTime()
    ) {
      return {
        status,
        position: null,
        customersAhead: 0,
        isNext: false,
      };
    }

    const customersAhead = await this.prisma.callSession.count({
      where: {
        astrologerId: consultation.astrologerId,
        status: 'PENDING',
        endedAt: null,
        expiresAt: {
          gt: now,
        },
        OR: [
          {
            createdAt: {
              lt: consultation.createdAt,
            },
          },
          {
            createdAt: consultation.createdAt,
            id: {
              lt: consultation.id,
            },
          },
        ],
      },
    });

    const position = customersAhead + 1;

    return {
      status,
      position,
      customersAhead,
      isNext: position === 1,
    };
  }
  async ensureConsultationExists(consultationId: string) {
    const consultation = await this.prisma.callSession.findUnique({
      where: {
        id: consultationId,
      },
      select: {
        id: true,
        userId: true,
        astrologerId: true,
        status: true,
        startedAt: true,
        expiresAt: true,
        endedAt: true,
        amountCharged: true,
        ratePerMinute: true,
        purchasedMinutes: true,
        extendedMinutes: true,
        isFreeChat: true,
      },
    });

    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }

    return consultation;
  }

  private toMoneyDecimal(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException('Invalid monetary amount');
    }

    return new Prisma.Decimal(value.toFixed(2));
  }
}

