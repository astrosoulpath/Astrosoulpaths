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

import { AgoraService } from './agora.service';
import { EndCallDto } from './dto/end-call.dto';
import { StartCallDto } from './dto/start-call.dto';

const ACTIVE_CALL_STATUS = 'ACTIVE';
const ENDED_CALL_STATUS = 'ENDED';
const EXPIRED_CALL_STATUS = 'EXPIRED';

const DEFAULT_PLATFORM_FEE_PERCENT = 30;

const MAX_CALL_HISTORY_RESULTS = 100;

@Injectable()
export class CallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agoraService: AgoraService,
  ) {}

  private async getAuthenticatedUser(
    supabaseId: string,
  ) {
    const normalizedSupabaseId =
      supabaseId?.trim();

    if (!normalizedSupabaseId) {
      throw new BadRequestException(
        'Authenticated user ID is required',
      );
    }

    const user =
      await this.prisma.user.findUnique({
        where: {
          supabaseId:
            normalizedSupabaseId,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          isActive: true,
          isBlocked: true,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'User account was not found',
      );
    }

    if (
      !user.isActive ||
      user.isBlocked
    ) {
      throw new BadRequestException(
        'User account is not active',
      );
    }

    return user;
  }

  private async getAvailableAstrologer(
    astrologerId: string,
  ) {
    const normalizedAstrologerId =
      astrologerId?.trim();

    if (!normalizedAstrologerId) {
      throw new BadRequestException(
        'Astrologer ID is required',
      );
    }

    const astrologer =
      await this.prisma.astrologer.findUnique({
        where: {
          id: normalizedAstrologerId,
        },
        select: {
          id: true,
          userId: true,
          pricePerMin: true,
          isOnline: true,
          isApproved: true,
          isVerified: true,
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              isActive: true,
              isBlocked: true,
            },
          },
        },
      });

    if (!astrologer) {
      throw new NotFoundException(
        'Astrologer was not found',
      );
    }

    if (
      !astrologer.isApproved ||
      !astrologer.isVerified
    ) {
      throw new BadRequestException(
        'Astrologer is not approved for consultations',
      );
    }

    if (
      !astrologer.user.isActive ||
      astrologer.user.isBlocked
    ) {
      throw new BadRequestException(
        'Astrologer account is not active',
      );
    }

    if (!astrologer.isOnline) {
      throw new BadRequestException(
        'Astrologer is currently offline',
      );
    }

    const pricePerMin = Number(
      astrologer.pricePerMin ?? 0,
    );

    if (
      !Number.isFinite(pricePerMin) ||
      pricePerMin <= 0
    ) {
      throw new BadRequestException(
        'Astrologer consultation price is not configured',
      );
    }

    return {
      ...astrologer,
      pricePerMin,
    };
  }

  private getPlatformFeePercent(): number {
  const configuredPercent = Number(
    process.env.ASTROLOGER_PLATFORM_FEE_PERCENT ??
      DEFAULT_PLATFORM_FEE_PERCENT,
  );

  if (
    !Number.isFinite(configuredPercent) ||
    configuredPercent < 0 ||
    configuredPercent > 100
  ) {
    return DEFAULT_PLATFORM_FEE_PERCENT;
  }

  return configuredPercent;
}

  private createChannelName(
    userId: string,
    astrologerUserId: string,
  ): string {
    const timestamp = Date.now();

    const randomSuffix = Math.random()
      .toString(36)
      .slice(2, 8);

    return [
      'asp',
      userId.slice(0, 8),
      astrologerUserId.slice(0, 8),
      timestamp,
      randomSuffix,
    ].join('-');
  }

  private serializeCallSession(
    session: {
      id: string;
      userId: string;
      astrologerId: string;
      channelName: string;
      ratePerMinute: number;
      purchasedMinutes: number;
      extendedMinutes: number;
      amountCharged: number;
      startedAt: Date;
      expiresAt: Date;
      endedAt: Date | null;
      status: string;
      createdAt: Date;
      astrologer?: {
        id: string;
        name: string | null;
        avatarUrl: string | null;
      };
    },
  ) {
    const totalMinutes =
      session.purchasedMinutes +
      session.extendedMinutes;

    const now = Date.now();

    const remainingSeconds =
      session.status ===
        ACTIVE_CALL_STATUS &&
      !session.endedAt
        ? Math.max(
            0,
            Math.ceil(
              (session.expiresAt.getTime() -
                now) /
                1000,
            ),
          )
        : 0;

    return {
      id: session.id,
      userId: session.userId,
      astrologerId:
        session.astrologerId,

      astrologerName:
        session.astrologer?.name ??
        'Astro Soul Path Astrologer',

      astrologerAvatarUrl:
        session.astrologer
          ?.avatarUrl ?? null,

      channelName:
        session.channelName,

      ratePerMinute:
        Number(
          session.ratePerMinute,
        ),

      purchasedMinutes:
        session.purchasedMinutes,

      extendedMinutes:
        session.extendedMinutes,

      totalMinutes,

      amountCharged:
        Number(
          session.amountCharged,
        ),

      remainingSeconds,

      startedAt:
        session.startedAt,

      expiresAt:
        session.expiresAt,

      endedAt:
        session.endedAt,

      status:
        session.status,

      createdAt:
        session.createdAt,
    };
  }

  private async expireCallIfRequired(
    callId: string,
  ) {
    const call =
      await this.prisma.callSession.findUnique({
        where: {
          id: callId,
        },
      });

    if (!call) {
      return null;
    }

    if (
      call.status ===
        ACTIVE_CALL_STATUS &&
      !call.endedAt &&
      call.expiresAt <= new Date()
    ) {
      return this.prisma.callSession.update({
        where: {
          id: call.id,
        },
        data: {
          status:
            EXPIRED_CALL_STATUS,
          endedAt: new Date(),
        },
      });
    }

    return call;
  }

  async startCall(
    supabaseId: string,
    dto: StartCallDto,
  ) {
    const user =
      await this.getAuthenticatedUser(
        supabaseId,
      );

    if (
      !Number.isInteger(dto.minutes) ||
      dto.minutes <= 0
    ) {
      throw new BadRequestException(
        'Consultation minutes must be a positive whole number',
      );
    }

    const astrologer =
      await this.getAvailableAstrologer(
        dto.astrologerId,
      );

    if (
      user.id ===
      astrologer.userId
    ) {
      throw new BadRequestException(
        'You cannot start a consultation with your own account',
      );
    }

    const currentTime =
      new Date();

    /*
     * Check whether the customer already has
     * an active consultation.
     */
    const existingUserCall =
      await this.prisma.callSession.findFirst({
        where: {
          OR: [
            {
              userId: user.id,
            },
            {
              astrologerId:
                user.id,
            },
          ],
          status:
            ACTIVE_CALL_STATUS,
          endedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    if (existingUserCall) {
      if (
        existingUserCall.expiresAt >
        currentTime
      ) {
        throw new ConflictException(
          'You already have an active consultation',
        );
      }

      await this.prisma.callSession.update({
        where: {
          id:
            existingUserCall.id,
        },
        data: {
          status:
            EXPIRED_CALL_STATUS,
          endedAt:
            currentTime,
        },
      });
    }

    /*
     * Check whether the selected astrologer
     * is already busy in another active call.
     */
    const astrologerActiveCall =
      await this.prisma.callSession.findFirst({
        where: {
          astrologerId:
            astrologer.userId,
          status:
            ACTIVE_CALL_STATUS,
          endedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    if (astrologerActiveCall) {
      if (
        astrologerActiveCall.expiresAt >
        currentTime
      ) {
        throw new ConflictException(
          'Astrologer is currently busy in another consultation',
        );
      }

      await this.prisma.callSession.update({
        where: {
          id:
            astrologerActiveCall.id,
        },
        data: {
          status:
            EXPIRED_CALL_STATUS,
          endedAt:
            currentTime,
        },
      });
    }

    const totalAmount =
      astrologer.pricePerMin *
      dto.minutes;

    if (
      !Number.isFinite(
        totalAmount,
      ) ||
      totalAmount <= 0
    ) {
      throw new BadRequestException(
        'Invalid consultation amount',
      );
    }

    const chargeAmount =
      new Prisma.Decimal(
        totalAmount.toFixed(2),
      );

    const startedAt =
      new Date();

    const expiresAt =
      new Date(
        startedAt.getTime() +
          dto.minutes *
            60 *
            1000,
      );

    const channelName =
      this.createChannelName(
        user.id,
        astrologer.userId,
      );

    const result =
      await this.prisma.$transaction(
        async (transaction) => {
          /*
           * Recheck active calls inside the transaction
           * to reduce duplicate call creation.
           */
          const duplicateCall =
            await transaction.callSession.findFirst({
              where: {
                status:
                  ACTIVE_CALL_STATUS,
                endedAt: null,
                OR: [
                  {
                    userId:
                      user.id,
                  },
                  {
                    astrologerId:
                      user.id,
                  },
                  {
                    astrologerId:
                      astrologer.userId,
                  },
                ],
                expiresAt: {
                  gt: new Date(),
                },
              },
            });

          if (duplicateCall) {
            throw new ConflictException(
              'User or astrologer already has an active consultation',
            );
          }

          const wallet =
            await transaction.wallet.upsert({
              where: {
                userId:
                  user.id,
              },
              update: {},
              create: {
                userId:
                  user.id,
                currency:
                  'INR',
              },
            });

          const availableBalance =
            wallet.balance.minus(
              wallet.lockedBalance,
            );

          if (
            availableBalance.lessThan(
              chargeAmount,
            )
          ) {
            throw new BadRequestException(
              'INSUFFICIENT_BALANCE',
            );
          }

          const balanceBefore =
            wallet.balance;

          const balanceAfter =
            balanceBefore.minus(
              chargeAmount,
            );

          const callSession =
            await transaction.callSession.create({
              data: {
                userId:
                  user.id,

                /*
                 * Current schema mein astrologerId
                 * astrologer ke User.id ko reference
                 * karta hai.
                 */
                astrologerId:
                  astrologer.userId,

                channelName,

                ratePerMinute:
                  astrologer.pricePerMin,

                purchasedMinutes:
                  dto.minutes,

                extendedMinutes:
                  0,

                amountCharged:
                  Number(
                    chargeAmount.toString(),
                  ),

                startedAt,
                expiresAt,

                status:
                  ACTIVE_CALL_STATUS,
              },
            });

          const updatedWallet =
            await transaction.wallet.update({
              where: {
                id:
                  wallet.id,
              },
              data: {
                balance:
                  balanceAfter,
              },
            });

          const ledgerEntry =
            await transaction.walletLedger.create({
              data: {
                walletId:
                  wallet.id,

                userId:
                  user.id,

                type:
                  LedgerType.CALL_DEDUCTION,

                amount:
                  chargeAmount,

                balanceBefore,
                balanceAfter,

                referenceType:
                  LedgerReferenceType.CALL_SESSION,

                referenceId:
                  callSession.id,

                description:
                  `${dto.minutes}-minute consultation with ${
                    astrologer.user
                      .name ??
                    'astrologer'
                  }`,
              },
            });

          return {
            callSession,
            updatedWallet,
            ledgerEntry,
          };
        },
        {
          isolationLevel:
            Prisma
              .TransactionIsolationLevel
              .Serializable,
        },
      );

    return {
      success: true,

      message:
        'Consultation started successfully',

      data: {
        call:
          this.serializeCallSession({
            ...result.callSession,

            astrologer:
              astrologer.user,
          }),

        wallet: {
          balance:
            Number(
              result.updatedWallet
                .balance,
            ),

          lockedBalance:
            Number(
              result.updatedWallet
                .lockedBalance,
            ),

          currency:
            result.updatedWallet
              .currency,
        },

        transaction: {
          id:
            result.ledgerEntry.id,

          amount:
            Number(
              result.ledgerEntry
                .amount,
            ),

          balanceBefore:
            Number(
              result.ledgerEntry
                .balanceBefore,
            ),

          balanceAfter:
            Number(
              result.ledgerEntry
                .balanceAfter,
            ),
        },
      },
    };
  }

    async endCall(
    supabaseId: string,
    callId: string,
    dto: EndCallDto,
  ) {
    const normalizedCallId =
      callId?.trim();

    if (!normalizedCallId) {
      throw new BadRequestException(
        'Call ID is required',
      );
    }

    const user =
      await this.getAuthenticatedUser(
        supabaseId,
      );

    const call =
      await this.prisma.callSession.findFirst({
        where: {
          id:
            normalizedCallId,

          OR: [
            {
              userId:
                user.id,
            },
            {
              astrologerId:
                user.id,
            },
          ],
        },

        include: {
          astrologer: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

    if (!call) {
      throw new NotFoundException(
        'Consultation was not found',
      );
    }

    /*
     * CallSession.astrologerId stores
     * the astrologer's User.id.
     *
     * AstrologerEarning.astrologerId requires
     * the Astrologer profile id.
     */
    const astrologerProfile =
      await this.prisma.astrologer.findUnique({
        where: {
          userId:
            call.astrologerId,
        },

        select: {
          id: true,
        },
      });

    if (!astrologerProfile) {
      throw new NotFoundException(
        'Astrologer profile was not found for this consultation',
      );
    }

    /*
     * Expired calls do not create an earning here.
     * Refund/reversal handling will remain a
     * separate settlement flow.
     */
    if (
      call.status ===
      EXPIRED_CALL_STATUS
    ) {
      return {
        success: true,

        message:
          'Consultation is already expired',

        data: {
          call:
            this.serializeCallSession(
              call,
            ),
        },
      };
    }

    const platformFeePercent =
      this.getPlatformFeePercent();

    const grossAmount =
      new Prisma.Decimal(
        Number(
          call.amountCharged,
        ).toFixed(2),
      );

    const platformFee =
      grossAmount
        .mul(platformFeePercent)
        .div(100)
        .toDecimalPlaces(2);

    const netAmount =
      grossAmount
        .minus(platformFee)
        .toDecimalPlaces(2);

    /*
     * Idempotent handling:
     * if the call was already ended, ensure the
     * earning exists without creating a duplicate.
     */
    if (
      call.endedAt ||
      call.status ===
        ENDED_CALL_STATUS
    ) {
      const earning =
        await this.prisma.astrologerEarning.upsert({
          where: {
            callSessionId:
              call.id,
          },

          update: {},

          create: {
            astrologerId:
              astrologerProfile.id,

            callSessionId:
              call.id,

            grossAmount,
            platformFee,
            netAmount,

            currency:
              'INR',

            status:
              AstrologerEarningStatus.AVAILABLE,

            availableAt:
              call.endedAt ??
              new Date(),
          },
        });

      return {
        success: true,

        message:
          'Consultation is already ended',

        data: {
          call:
            this.serializeCallSession(
              call,
            ),

          earning: {
            id:
              earning.id,

            grossAmount:
              Number(
                earning
                  .grossAmount
                  .toString(),
              ),

            platformFee:
              Number(
                earning
                  .platformFee
                  .toString(),
              ),

            platformFeePercent,

            netAmount:
              Number(
                earning
                  .netAmount
                  .toString(),
              ),

            currency:
              earning.currency,

            status:
              earning.status,

            availableAt:
              earning.availableAt,
          },
        },
      };
    }

    const endedAt =
      new Date();

    const result =
      await this.prisma.$transaction(
        async (transaction) => {
          const updatedCall =
            await transaction.callSession.update({
              where: {
                id:
                  call.id,
              },

              data: {
                endedAt,

                status:
                  ENDED_CALL_STATUS,
              },

              include: {
                astrologer: {
                  select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                  },
                },
              },
            });

          const earning =
            await transaction.astrologerEarning.upsert({
              where: {
                callSessionId:
                  call.id,
              },

              update: {
                astrologerId:
                  astrologerProfile.id,

                grossAmount,
                platformFee,
                netAmount,

                currency:
                  'INR',

                status:
                  AstrologerEarningStatus.AVAILABLE,

                availableAt:
                  endedAt,

                reversedAt:
                  null,
              },

              create: {
                astrologerId:
                  astrologerProfile.id,

                callSessionId:
                  call.id,

                grossAmount,
                platformFee,
                netAmount,

                currency:
                  'INR',

                status:
                  AstrologerEarningStatus.AVAILABLE,

                availableAt:
                  endedAt,
              },
            });

          return {
            updatedCall,
            earning,
          };
        },

        {
          isolationLevel:
            Prisma
              .TransactionIsolationLevel
              .Serializable,
        },
      );

    return {
      success: true,

      message:
        dto.reason?.trim() ||
        'Consultation ended successfully',

      data: {
        call:
          this.serializeCallSession(
            result.updatedCall,
          ),

        earning: {
          id:
            result.earning.id,

          grossAmount:
            Number(
              result.earning
                .grossAmount
                .toString(),
            ),

          platformFee:
            Number(
              result.earning
                .platformFee
                .toString(),
            ),

          platformFeePercent,

          netAmount:
            Number(
              result.earning
                .netAmount
                .toString(),
            ),

          currency:
            result.earning
              .currency,

          status:
            result.earning
              .status,

          availableAt:
            result.earning
              .availableAt,
        },
      },
    };
  }
  
  async getCurrentCall(
    supabaseId: string,
  ) {
    const user =
      await this.getAuthenticatedUser(
        supabaseId,
      );

    /*
     * User aur astrologer dono current call
     * retrieve kar sakte hain.
     */
    const call =
      await this.prisma.callSession.findFirst({
        where: {
          OR: [
            {
              userId:
                user.id,
            },
            {
              astrologerId:
                user.id,
            },
          ],

          status:
            ACTIVE_CALL_STATUS,

          endedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          astrologer: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

    if (!call) {
      return {
        success: true,
        data: null,
      };
    }

    if (
      call.expiresAt <=
      new Date()
    ) {
      const expiredCall =
        await this.prisma.callSession.update({
          where: {
            id:
              call.id,
          },
          data: {
            status:
              EXPIRED_CALL_STATUS,

            endedAt:
              new Date(),
          },
          include: {
            astrologer: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        });

      return {
        success: true,

        data: {
          call:
            this.serializeCallSession(
              expiredCall,
            ),
        },
      };
    }

    return {
      success: true,

      data: {
        call:
          this.serializeCallSession(
            call,
          ),
      },
    };
  }

  async getCallHistory(
    supabaseId: string,
  ) {
    const user =
      await this.getAuthenticatedUser(
        supabaseId,
      );

    const calls =
      await this.prisma.callSession.findMany({
        where: {
          OR: [
            {
              userId:
                user.id,
            },
            {
              astrologerId:
                user.id,
            },
          ],
        },

        orderBy: {
          createdAt: 'desc',
        },

        take:
          MAX_CALL_HISTORY_RESULTS,

        include: {
          astrologer: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

    return {
      success: true,

      data: {
        calls:
          calls.map(
            (call) =>
              this.serializeCallSession(
                call,
              ),
          ),

        total:
          calls.length,
      },
    };
  }

  async generateAgoraToken(
    supabaseId: string,
    callId: string,
  ) {
    const normalizedCallId =
      callId?.trim();

    if (!normalizedCallId) {
      throw new BadRequestException(
        'Call ID is required',
      );
    }

    const user =
      await this.getAuthenticatedUser(
        supabaseId,
      );

    await this.expireCallIfRequired(
      normalizedCallId,
    );

    const call =
      await this.prisma.callSession.findFirst({
        where: {
          id:
            normalizedCallId,

          OR: [
            {
              userId:
                user.id,
            },
            {
              astrologerId:
                user.id,
            },
          ],

          status:
            ACTIVE_CALL_STATUS,

          endedAt:
            null,

          expiresAt: {
            gt: new Date(),
          },
        },
      });

    if (!call) {
      throw new NotFoundException(
        'Active consultation not found or consultation has expired',
      );
    }

    /*
     * Agora numeric UID must remain inside
     * a safe positive integer range.
     */
    const uid =
      Math.floor(
        Math.random() *
          2_000_000_000,
      ) + 1;

    const agora =
      this.agoraService.generateRtcToken(
        call.channelName,
        uid,
      );

    return {
      success: true,

      data: {
        ...agora,

        callId:
          call.id,

        channelName:
          call.channelName,

        uid,

        expiresAt:
          call.expiresAt,
      },
    };
  }
}