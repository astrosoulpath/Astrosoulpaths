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

export type ConsultationPaginationParams = {
  page?: number;
  limit?: number;
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

        const updatedWallet = await transaction.wallet.update({
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

  async findUserConsultationHistory(
    userId: string,
    params: ConsultationPaginationParams = {},
  ) {
    const { page, limit, skip } = this.getPagination(params);

    const where: Prisma.CallSessionWhereInput = {
      userId,
    };

    const [items, total] = await Promise.all([
      this.prisma.callSession.findMany({
        where,
        skip,
        take: limit,
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

    const where: Prisma.CallSessionWhereInput = {
      astrologerId: astrologerUserId,
    };

    const [items, total] = await Promise.all([
      this.prisma.callSession.findMany({
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

        const updatedWallet = await transaction.wallet.update({
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

        const lockedBalanceAfter = wallet.lockedBalance.greaterThanOrEqualTo(
          reservedAmount,
        )
          ? wallet.lockedBalance.minus(reservedAmount)
          : new Prisma.Decimal(0);

        await transaction.wallet.update({
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
    const platformFeePercent = params.platformFeePercent;

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
            availableAt: new Date(Date.now() + 5 * 60 * 1000),
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
            availableAt: new Date(),
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

