import { AgoraService } from './agora.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LedgerReferenceType,
  LedgerType,
  Prisma,
} from '@prisma/client';



import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EndCallDto } from './dto/end-call.dto';
import { StartCallDto } from './dto/start-call.dto';

const ACTIVE_CALL_STATUS = 'ACTIVE';
const ENDED_CALL_STATUS = 'ENDED';
const EXPIRED_CALL_STATUS = 'EXPIRED';

@Injectable()
export class CallService {
  constructor(
  private readonly prisma: PrismaService,
  private readonly agoraService: AgoraService,
) {}

  private async getAuthenticatedUser(
    supabaseId: string,
  ) {
    if (!supabaseId) {
      throw new BadRequestException(
        'Authenticated user ID is required',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: {
        supabaseId,
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

    if (!user.isActive || user.isBlocked) {
      throw new BadRequestException(
        'User account is not active',
      );
    }

    return user;
  }

  private async getAvailableAstrologer(
    astrologerId: string,
  ) {
    const astrologer =
      await this.prisma.astrologer.findUnique({
        where: {
          id: astrologerId,
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

  private createChannelName(
    userId: string,
    astrologerUserId: string,
  ) {
    const timestamp = Date.now();

    return `asp-${userId.slice(
      0,
      8,
    )}-${astrologerUserId.slice(
      0,
      8,
    )}-${timestamp}`;
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
    return {
      id: session.id,
      userId: session.userId,
      astrologerId: session.astrologerId,
      astrologerName:
        session.astrologer?.name ??
        'Astro Soul Path Astrologer',
      astrologerAvatarUrl:
        session.astrologer?.avatarUrl ?? null,
      channelName: session.channelName,
      ratePerMinute: session.ratePerMinute,
      purchasedMinutes:
        session.purchasedMinutes,
      extendedMinutes:
        session.extendedMinutes,
      totalMinutes:
        session.purchasedMinutes +
        session.extendedMinutes,
      amountCharged: session.amountCharged,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
      endedAt: session.endedAt,
      status: session.status,
      createdAt: session.createdAt,
    };
  }

  async startCall(
    supabaseId: string,
    dto: StartCallDto,
  ) {
    const user =
      await this.getAuthenticatedUser(
        supabaseId,
      );

    const astrologer =
      await this.getAvailableAstrologer(
        dto.astrologerId,
      );

    if (user.id === astrologer.userId) {
      throw new BadRequestException(
        'You cannot start a consultation with your own account',
      );
    }

    const existingActiveCall =
      await this.prisma.callSession.findFirst({
        where: {
          userId: user.id,
          status: ACTIVE_CALL_STATUS,
          endedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    if (existingActiveCall) {
      if (
        existingActiveCall.expiresAt >
        new Date()
      ) {
        throw new ConflictException(
          'You already have an active consultation',
        );
      }

      await this.prisma.callSession.update({
        where: {
          id: existingActiveCall.id,
        },
        data: {
          status: EXPIRED_CALL_STATUS,
          endedAt: new Date(),
        },
      });
    }

    const totalAmount =
      astrologer.pricePerMin * dto.minutes;

    if (
      !Number.isFinite(totalAmount) ||
      totalAmount <= 0
    ) {
      throw new BadRequestException(
        'Invalid consultation amount',
      );
    }

    const chargeAmount = new Prisma.Decimal(
      totalAmount.toFixed(2),
    );

    const startedAt = new Date();

    const expiresAt = new Date(
      startedAt.getTime() +
        dto.minutes * 60 * 1000,
    );

    const channelName =
      this.createChannelName(
        user.id,
        astrologer.userId,
      );

    const result = await this.prisma.$transaction(
      async (transaction) => {
        const wallet =
          await transaction.wallet.upsert({
            where: {
              userId: user.id,
            },
            update: {},
            create: {
              userId: user.id,
              currency: 'INR',
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
              userId: user.id,

              // CallSession relation User.id ko reference karti hai.
              astrologerId:
                astrologer.userId,

              channelName,
              ratePerMinute:
                astrologer.pricePerMin,
              purchasedMinutes:
                dto.minutes,
              extendedMinutes: 0,
              amountCharged:
                Number(
                  chargeAmount.toString(),
                ),
              startedAt,
              expiresAt,
              status: ACTIVE_CALL_STATUS,
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
              userId: user.id,
              type:
                LedgerType.CALL_DEDUCTION,
              amount: chargeAmount,
              balanceBefore,
              balanceAfter,
              referenceType:
                LedgerReferenceType.CALL_SESSION,
              referenceId:
                callSession.id,
              description: `${dto.minutes}-minute consultation with ${
                astrologer.user.name ??
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
          Prisma.TransactionIsolationLevel
            .Serializable,
      },
    );

    return {
      success: true,
      message:
        'Consultation started successfully',
      data: {
        call: this.serializeCallSession({
          ...result.callSession,
          astrologer:
            astrologer.user,
        }),

        wallet: {
          balance: Number(
            result.updatedWallet.balance,
          ),
          lockedBalance: Number(
            result.updatedWallet
              .lockedBalance,
          ),
          currency:
            result.updatedWallet.currency,
        },

        transaction: {
          id: result.ledgerEntry.id,
          amount: Number(
            result.ledgerEntry.amount,
          ),
          balanceBefore: Number(
            result.ledgerEntry
              .balanceBefore,
          ),
          balanceAfter: Number(
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
    const user =
      await this.getAuthenticatedUser(
        supabaseId,
      );

    const call =
      await this.prisma.callSession.findFirst({
        where: {
          id: callId,
          userId: user.id,
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

    if (
      call.endedAt ||
      call.status === ENDED_CALL_STATUS
    ) {
      return {
        success: true,
        message:
          'Consultation is already ended',
        data: {
          call:
            this.serializeCallSession(
              call,
            ),
        },
      };
    }

    const endedAt = new Date();

    const updatedCall =
      await this.prisma.callSession.update({
        where: {
          id: call.id,
        },
        data: {
          endedAt,
          status: ENDED_CALL_STATUS,
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
      message:
        dto.reason?.trim() ||
        'Consultation ended successfully',
      data: {
        call:
          this.serializeCallSession(
            updatedCall,
          ),
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

    const call =
      await this.prisma.callSession.findFirst({
        where: {
          userId: user.id,
          status: ACTIVE_CALL_STATUS,
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

    if (call.expiresAt <= new Date()) {
      const expiredCall =
        await this.prisma.callSession.update({
          where: {
            id: call.id,
          },
          data: {
            status:
              EXPIRED_CALL_STATUS,
            endedAt: new Date(),
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
          userId: user.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100,
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
        calls: calls.map((call) =>
          this.serializeCallSession(
            call,
          ),
        ),
        total: calls.length,
      },
    };
  }
  async generateAgoraToken(
  supabaseId: string,
  callId: string,
) {
  const user =
    await this.getAuthenticatedUser(
      supabaseId,
    );

  const call =
    await this.prisma.callSession.findFirst({
      where: {
        id: callId,
        OR: [
          { userId: user.id },
          { astrologerId: user.id },
        ],
        status: ACTIVE_CALL_STATUS,
      },
    });

  if (!call) {
    throw new NotFoundException(
      'Active consultation not found',
    );
  }

  const uid = Math.floor(
    Math.random() * 1000000,
  );

  const agora =
    this.agoraService.generateRtcToken(
      call.channelName,
      uid,
    );

  return {
    success: true,
    data: {
      ...agora,
      callId: call.id,
    },
  };
}
}