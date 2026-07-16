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
  ratePerMinute: number;
  purchasedMinutes: number;
  amountCharged: number;
  startedAt: Date;
  expiresAt: Date;
  status: string;
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
  platformFeePercent?: number;
};

@Injectable()
export class ConsultationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getPagination(
    params: ConsultationPaginationParams = {},
  ) {
    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.min(
      Math.max(params.limit ?? 20, 1),
      100,
    );

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

  async createConsultation(
    params: CreateConsultationParams,
  ) {
    const chargeAmount = this.toMoneyDecimal(
      params.amountCharged,
    );

    return this.prisma.$transaction(
      async (transaction) => {
        const now = new Date();

        /*
         * Repeat active-session checks inside the transaction.
         * This reduces the risk of duplicate concurrent bookings.
         */
        const [
          existingUserConsultation,
          existingAstrologerConsultation,
        ] = await Promise.all([
          transaction.callSession.findFirst({
            where: {
              userId: params.userId,
              endedAt: null,
              expiresAt: {
                gt: now,
              },
            },
            select: {
              id: true,
            },
          }),

          transaction.callSession.findFirst({
            where: {
              astrologerId: params.astrologerId,
              endedAt: null,
              expiresAt: {
                gt: now,
              },
            },
            select: {
              id: true,
            },
          }),
        ]);

        if (existingUserConsultation) {
          throw new ConflictException(
            'You already have an active consultation',
          );
        }

        if (existingAstrologerConsultation) {
          throw new ConflictException(
            'The astrologer is currently busy with another consultation',
          );
        }

        const wallet = await transaction.wallet.upsert({
          where: {
            userId: params.userId,
          },
          update: {},
          create: {
            userId: params.userId,
            currency: 'INR',
          },
        });

        const availableBalance = wallet.balance.minus(
          wallet.lockedBalance,
        );

        if (availableBalance.lessThan(chargeAmount)) {
          throw new BadRequestException(
            'INSUFFICIENT_BALANCE',
          );
        }

        const balanceBefore = wallet.balance;
        const balanceAfter =
          balanceBefore.minus(chargeAmount);

        const consultation =
          await transaction.callSession.create({
            data: {
              userId: params.userId,
              astrologerId: params.astrologerId,
              channelName: params.channelName,
              ratePerMinute: params.ratePerMinute,
              purchasedMinutes:
                params.purchasedMinutes,
              extendedMinutes: 0,
              amountCharged: Number(
                chargeAmount.toString(),
              ),
              startedAt: params.startedAt,
              expiresAt: params.expiresAt,
              status: params.status,
            },
          });

        const updatedWallet =
          await transaction.wallet.update({
            where: {
              id: wallet.id,
            },
            data: {
              balance: balanceAfter,
            },
          });

        const ledgerEntry =
          await transaction.walletLedger.create({
            data: {
              walletId: wallet.id,
              userId: params.userId,
              type: LedgerType.CALL_DEDUCTION,
              amount: chargeAmount,
              balanceBefore,
              balanceAfter,
              referenceType:
                LedgerReferenceType.CALL_SESSION,
              referenceId: consultation.id,
              description: `${params.purchasedMinutes}-minute consultation`,
            },
          });

        const populatedConsultation =
          await transaction.callSession.findUniqueOrThrow({
            where: {
              id: consultation.id,
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
            balance: Number(
              updatedWallet.balance.toString(),
            ),
            lockedBalance: Number(
              updatedWallet.lockedBalance.toString(),
            ),
            currency: updatedWallet.currency,
          },

          transaction: {
            id: ledgerEntry.id,
            amount: Number(
              ledgerEntry.amount.toString(),
            ),
            balanceBefore: Number(
              ledgerEntry.balanceBefore.toString(),
            ),
            balanceAfter: Number(
              ledgerEntry.balanceAfter.toString(),
            ),
          },
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  /*
   * ============================================================
   * CONSULTATION DETAILS
   * ============================================================
   */

  async findConsultationById(
    consultationId: string,
  ) {
    const consultation =
      await this.prisma.callSession.findUnique({
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
      throw new NotFoundException(
        'Consultation not found',
      );
    }

    return consultation;
  }

  /*
   * ============================================================
   * ACTIVE CONSULTATION
   * ============================================================
   */

  async findActiveUserConsultation(
    userId: string,
  ) {
    return this.prisma.callSession.findFirst({
      where: {
        userId,
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

  async findActiveAstrologerConsultation(
    astrologerUserId: string,
  ) {
    return this.prisma.callSession.findFirst({
      where: {
        astrologerId: astrologerUserId,
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

  async hasActiveConsultation(
    userId: string,
    astrologerUserId?: string,
  ) {
    const count =
      await this.prisma.callSession.count({
        where: {
          userId,

          ...(astrologerUserId
            ? {
                astrologerId:
                  astrologerUserId,
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
    const { page, limit, skip } =
      this.getPagination(params);

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
    const { page, limit, skip } =
      this.getPagination(params);

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

  async findLatestUserConsultation(
    userId: string,
  ) {
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

  async findLatestAstrologerConsultation(
    astrologerUserId: string,
  ) {
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

  async findAvailableAstrologerByUserId(
    astrologerUserId: string,
  ) {
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

  async findAstrologerByUserId(
    astrologerUserId: string,
  ) {
    const astrologer =
      await this.prisma.astrologer.findUnique({
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
      throw new NotFoundException(
        'Astrologer not found',
      );
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

  async findUserWalletOrThrow(
    userId: string,
  ) {
    const wallet =
      await this.findUserWallet(userId);

    if (!wallet) {
      throw new NotFoundException(
        'User wallet not found',
      );
    }

    return wallet;
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
    const additionalAmount =
      this.toMoneyDecimal(
        params.additionalAmount,
      );

    return this.prisma.$transaction(
      async (transaction) => {
        const consultation =
          await transaction.callSession.findUnique({
            where: {
              id: consultationId,
            },
          });

        if (!consultation) {
          throw new NotFoundException(
            'Consultation not found',
          );
        }

        const normalizedStatus =
          consultation.status.toUpperCase();

        if (
          consultation.endedAt ||
          [
            'COMPLETED',
            'CANCELLED',
            'ENDED',
            'EXPIRED',
          ].includes(normalizedStatus)
        ) {
          throw new ConflictException(
            'This consultation cannot be extended',
          );
        }

        const wallet =
          await transaction.wallet.findUnique({
            where: {
              userId: consultation.userId,
            },
          });

        if (!wallet) {
          throw new NotFoundException(
            'User wallet not found',
          );
        }

        const availableBalance =
          wallet.balance.minus(
            wallet.lockedBalance,
          );

        if (
          availableBalance.lessThan(
            additionalAmount,
          )
        ) {
          throw new BadRequestException(
            'INSUFFICIENT_BALANCE',
          );
        }

        const balanceBefore = wallet.balance;
        const balanceAfter =
          balanceBefore.minus(additionalAmount);

        const updatedConsultation =
          await transaction.callSession.update({
            where: {
              id: consultationId,
            },
            data: {
              extendedMinutes: {
                increment:
                  params.additionalMinutes,
              },

              amountCharged: {
                increment:
                  params.additionalAmount,
              },

              expiresAt: params.newExpiresAt,
            },
          });

        const updatedWallet =
          await transaction.wallet.update({
            where: {
              id: wallet.id,
            },
            data: {
              balance: balanceAfter,
            },
          });

        const ledgerEntry =
          await transaction.walletLedger.create({
            data: {
              walletId: wallet.id,
              userId: consultation.userId,
              type: LedgerType.CALL_DEDUCTION,
              amount: additionalAmount,
              balanceBefore,
              balanceAfter,
              referenceType:
                LedgerReferenceType.CALL_SESSION,
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
            balance: Number(
              updatedWallet.balance.toString(),
            ),
            lockedBalance: Number(
              updatedWallet.lockedBalance.toString(),
            ),
            currency: updatedWallet.currency,
          },

          transaction: {
            id: ledgerEntry.id,
            amount: Number(
              ledgerEntry.amount.toString(),
            ),
            balanceBefore: Number(
              ledgerEntry.balanceBefore.toString(),
            ),
            balanceAfter: Number(
              ledgerEntry.balanceAfter.toString(),
            ),
          },
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  /*
   * ============================================================
   * CANCEL CONSULTATION
   * ============================================================
   */

  async cancelConsultation(
    consultationId: string,
    status = 'CANCELLED',
  ) {
    return this.prisma.$transaction(
      async (transaction) => {
        const consultation =
          await transaction.callSession.findUnique({
            where: {
              id: consultationId,
            },
          });

        if (!consultation) {
          throw new NotFoundException(
            'Consultation not found',
          );
        }

        if (consultation.endedAt) {
          throw new ConflictException(
            'Consultation has already ended',
          );
        }

        await transaction.callSession.update({
          where: {
            id: consultationId,
          },
          data: {
            status,
            endedAt: new Date(),
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
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
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
    const platformFeePercent =
      params.platformFeePercent ?? 20;

    if (
      !Number.isFinite(platformFeePercent) ||
      platformFeePercent < 0 ||
      platformFeePercent > 100
    ) {
      throw new BadRequestException(
        'Platform fee percentage must be between 0 and 100',
      );
    }

    const grossAmount = this.toMoneyDecimal(
      params.amountCharged,
    );

    return this.prisma.$transaction(
      async (transaction) => {
        const consultation =
          await transaction.callSession.findUnique({
            where: {
              id: consultationId,
            },
          });

        if (!consultation) {
          throw new NotFoundException(
            'Consultation not found',
          );
        }

        const normalizedStatus =
          consultation.status.toUpperCase();

        if (
          consultation.endedAt &&
          normalizedStatus === 'COMPLETED'
        ) {
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

        if (normalizedStatus === 'CANCELLED') {
          throw new ConflictException(
            'A cancelled consultation cannot be completed',
          );
        }

        const astrologer =
          await transaction.astrologer.findUnique({
            where: {
              userId: consultation.astrologerId,
            },
            select: {
              id: true,
            },
          });

        if (!astrologer) {
          throw new NotFoundException(
            'Astrologer profile not found',
          );
        }

        const platformFee = grossAmount
          .mul(platformFeePercent)
          .div(100)
          .toDecimalPlaces(2);

        const netAmount =
          grossAmount.minus(platformFee);

        await transaction.callSession.update({
          where: {
            id: consultationId,
          },
          data: {
            amountCharged: Number(
              grossAmount.toString(),
            ),

            endedAt:
              params.endedAt ?? new Date(),

            status:
              params.status ?? 'COMPLETED',
          },
        });

        await transaction.astrologerEarning.upsert({
          where: {
            callSessionId: consultationId,
          },

          update: {
            grossAmount,
            platformFee,
            netAmount,
            currency: 'INR',
            status:
              AstrologerEarningStatus.PENDING,
            availableAt: new Date(),
            paidAt: null,
            reversedAt: null,
          },

          create: {
            astrologerId: astrologer.id,
            callSessionId: consultationId,
            grossAmount,
            platformFee,
            netAmount,
            currency: 'INR',
            status:
              AstrologerEarningStatus.PENDING,
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
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  /*
   * ============================================================
   * REVIEW / RATING
   * ============================================================
   */

  async hasUserReviewedAstrologer(
    userId: string,
    astrologerId: string,
  ) {
    const review =
      await this.prisma.review.findFirst({
        where: {
          userId,
          astrologerId,
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
    rating: number;
    comment?: string;
  }) {
    return this.prisma.review.create({
      data: {
        userId: params.userId,
        astrologerId: params.astrologerId,
        rating: params.rating,
        comment: params.comment,
      },
      include: {
        user: true,
        astrologer: true,
      },
    });
  }

  async getAstrologerRatingSummary(
    astrologerId: string,
  ) {
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

  async ensureConsultationExists(
    consultationId: string,
  ) {
    const consultation =
      await this.prisma.callSession.findUnique({
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
      throw new NotFoundException(
        'Consultation not found',
      );
    }

    return consultation;
  }

  private toMoneyDecimal(value: number) {
    if (
      !Number.isFinite(value) ||
      value < 0
    ) {
      throw new BadRequestException(
        'Invalid monetary amount',
      );
    }

    return new Prisma.Decimal(
      value.toFixed(2),
    );
  }
}