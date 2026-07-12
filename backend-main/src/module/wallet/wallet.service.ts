import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LedgerReferenceType,
  LedgerType,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RechargeWalletDto } from './dto/recharge-wallet.dto';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private async findUserBySupabaseId(
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
        supabaseId: true,
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

  private async getOrCreateWallet(userId: string) {
    return this.prisma.wallet.upsert({
      where: {
        userId,
      },
      update: {},
      create: {
        userId,
        currency: 'INR',
      },
    });
  }

  async getWallet(supabaseId: string) {
    const user =
      await this.findUserBySupabaseId(supabaseId);

    const wallet =
      await this.getOrCreateWallet(user.id);

    const balance = Number(wallet.balance);
    const lockedBalance = Number(
      wallet.lockedBalance,
    );

    return {
      success: true,
      data: {
        id: wallet.id,
        balance,
        lockedBalance,
        availableBalance: Math.max(
          0,
          balance - lockedBalance,
        ),
        currency: wallet.currency,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      },
    };
  }

  async getWalletHistory(supabaseId: string) {
    const user =
      await this.findUserBySupabaseId(supabaseId);

    const wallet =
      await this.getOrCreateWallet(user.id);

    const ledgerEntries =
      await this.prisma.walletLedger.findMany({
        where: {
          walletId: wallet.id,
          userId: user.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100,
      });

    const creditTypes: LedgerType[] = [
      LedgerType.RECHARGE,
      LedgerType.REFUND,
      LedgerType.BONUS,
      LedgerType.GIFT_RECEIVED,
    ];

    const transactions = ledgerEntries.map(
      (entry) => {
        const isCredit = creditTypes.includes(
          entry.type,
        );

        return {
          id: entry.id,
          type: isCredit ? 'credit' : 'debit',
          ledgerType: entry.type,
          title:
            entry.description ||
            this.getTransactionTitle(entry.type),
          amount: Number(entry.amount),
          balanceBefore: Number(
            entry.balanceBefore,
          ),
          balanceAfter: Number(
            entry.balanceAfter,
          ),
          referenceType:
            entry.referenceType,
          referenceId:
            entry.referenceId,
          date: entry.createdAt,
          createdAt: entry.createdAt,
        };
      },
    );

    return {
      success: true,
      data: {
        transactions,
        total: transactions.length,
      },
    };
  }

  async rechargeWallet(
    supabaseId: string,
    dto: RechargeWalletDto,
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException(
        'Direct wallet recharge is disabled in production',
      );
    }

    const user =
      await this.findUserBySupabaseId(supabaseId);

    const amount = new Prisma.Decimal(
      dto.amount.toFixed(2),
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

        const balanceBefore = wallet.balance;
        const balanceAfter =
          balanceBefore.plus(amount);

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
              type: LedgerType.RECHARGE,
              amount,
              balanceBefore,
              balanceAfter,
              referenceType:
                LedgerReferenceType.WALLET_RECHARGE,
              referenceId: `LOCAL-${Date.now()}`,
              description:
                'Local development wallet recharge',
            },
          });

        return {
          wallet: updatedWallet,
          ledgerEntry,
        };
      },
    );

    const walletBalance = Number(
      result.wallet.balance,
    );

    const lockedBalance = Number(
      result.wallet.lockedBalance,
    );

    return {
      success: true,
      message: 'Wallet recharged successfully',
      data: {
        wallet: {
          id: result.wallet.id,
          balance: walletBalance,
          lockedBalance,
          availableBalance: Math.max(
            0,
            walletBalance - lockedBalance,
          ),
          currency:
            result.wallet.currency,
        },

        transaction: {
          id: result.ledgerEntry.id,
          type: 'credit',
          ledgerType:
            result.ledgerEntry.type,
          title:
            result.ledgerEntry.description ||
            'Wallet Recharge',
          amount: Number(
            result.ledgerEntry.amount,
          ),
          balanceBefore: Number(
            result.ledgerEntry.balanceBefore,
          ),
          balanceAfter: Number(
            result.ledgerEntry.balanceAfter,
          ),
          referenceType:
            result.ledgerEntry.referenceType,
          referenceId:
            result.ledgerEntry.referenceId,
          date:
            result.ledgerEntry.createdAt,
          createdAt:
            result.ledgerEntry.createdAt,
        },
      },
    };
  }

  private getTransactionTitle(
    type: LedgerType,
  ): string {
    switch (type) {
      case LedgerType.RECHARGE:
        return 'Wallet Recharge';

      case LedgerType.CALL_DEDUCTION:
        return 'Consultation Deduction';

      case LedgerType.REFUND:
        return 'Wallet Refund';

      case LedgerType.BONUS:
        return 'Wallet Bonus';

      case LedgerType.PENALTY:
        return 'Penalty';

      case LedgerType.WITHDRAWAL:
        return 'Wallet Withdrawal';

      case LedgerType.GIFT_SENT:
        return 'Gift Sent';

      case LedgerType.GIFT_RECEIVED:
        return 'Gift Received';

      default:
        return 'Wallet Transaction';
    }
  }
}