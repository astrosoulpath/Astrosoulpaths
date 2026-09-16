import { Injectable, Logger } from '@nestjs/common';
import {
  AstrologerEarningStatus,
  AstrologerPayoutStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type RazorpayPayoutWebhook = {
  event?: string;
  payload?: {
    payout?: {
      entity?: {
        id?: string;
        status?: string;
        failure_reason?: string | null;
        status_details?: unknown;
      };
    };
  };
};

@Injectable()
export class AstrologerPayoutWebhookService {
  private readonly logger = new Logger(AstrologerPayoutWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async process(event: RazorpayPayoutWebhook) {
    const eventName = event?.event?.trim();

    const providerPayout = event?.payload?.payout?.entity;

    const providerReference = providerPayout?.id?.trim();

    if (!eventName || !providerReference) {
      this.logger.warn('payout_webhook.missing_payout');

      return {
        success: true,
        ignored: true,
      };
    }

    const payout = await this.prisma.astrologerPayout.findFirst({
      where: {
        providerReference,
      },
      include: {
        earnings: true,
      },
    });

    if (!payout) {
      /*
       * A valid Razorpay webhook can belong to another
       * payout created outside this application.
       * Do not mutate anything.
       */
      this.logger.warn(
        `payout_webhook.unknown_provider_id providerReference=${providerReference}`,
      );

      return {
        success: true,
        ignored: true,
      };
    }

    const providerStatus =
      providerPayout?.status || eventName.replace('payout.', '');

    const statusDetails = providerPayout?.status_details;

    if (eventName === 'payout.processed') {
      return this.completePayout(
        payout.id,
        providerReference,
        providerStatus,
        statusDetails,
      );
    }

    if (eventName === 'payout.failed' || eventName === 'payout.reversed') {
      return this.releasePayout(
        payout.id,
        providerReference,
        providerStatus,
        providerPayout?.failure_reason || eventName,
        statusDetails,
      );
    }

    if (
      eventName === 'payout.queued' ||
      eventName === 'payout.initiated' ||
      eventName === 'payout.pending' ||
      eventName === 'payout.updated'
    ) {
      await this.prisma.astrologerPayout.updateMany({
        where: {
          id: payout.id,

          /*
           * Terminal success must never be downgraded by a
           * delayed/out-of-order intermediate webhook.
           */
          status: {
            in: [
              AstrologerPayoutStatus.REQUESTED,
              AstrologerPayoutStatus.PROCESSING,
            ],
          },
        },
        data: {
          status: AstrologerPayoutStatus.PROCESSING,
          providerStatus,
          providerStatusDetails: this.toJson(statusDetails),
          lastWebhookAt: new Date(),
          processedAt: payout.processedAt ?? new Date(),
        },
      });

      return {
        success: true,
        status: 'PROCESSING',
      };
    }

    return {
      success: true,
      ignored: true,
    };
  }

  private async completePayout(
    payoutId: string,
    providerReference: string,
    providerStatus: string,
    statusDetails: unknown,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const payout = await tx.astrologerPayout.findUnique({
          where: {
            id: payoutId,
          },
          include: {
            earnings: true,
          },
        });

        if (!payout) {
          return {
            success: true,
            ignored: true,
          };
        }

        if (payout.status === AstrologerPayoutStatus.COMPLETED) {
          return {
            success: true,
            duplicate: true,
          };
        }

        /*
         * FAILED/CANCELLED payouts have already had their
         * earnings released. Never convert them to completed.
         */
        if (
          payout.status === AstrologerPayoutStatus.FAILED ||
          payout.status === AstrologerPayoutStatus.CANCELLED
        ) {
          return {
            success: true,
            ignored: true,
          };
        }

        const earningIds = payout.earnings.map((earning) => earning.id);

        if (earningIds.length === 0) {
          throw new Error('Payout has no reserved earnings');
        }

        const paidAt = new Date();

        const result = await tx.astrologerEarning.updateMany({
          where: {
            id: {
              in: earningIds,
            },
            payoutId: payout.id,
            status: AstrologerEarningStatus.AVAILABLE,
          },
          data: {
            status: AstrologerEarningStatus.PAID,
            paidAt,
          },
        });

        if (result.count !== earningIds.length) {
          throw new Error('Reserved payout earnings are inconsistent');
        }

        await tx.astrologerPayout.update({
          where: {
            id: payout.id,
          },
          data: {
            status: AstrologerPayoutStatus.COMPLETED,
            providerReference,
            providerStatus,
            providerStatusDetails: this.toJson(statusDetails),
            completedAt: paidAt,
            processedAt: payout.processedAt ?? paidAt,
            lastWebhookAt: paidAt,
            failureReason: null,
          },
        });

        return {
          success: true,
          status: 'COMPLETED',
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  private async releasePayout(
    payoutId: string,
    providerReference: string,
    providerStatus: string,
    failureReason: string,
    statusDetails: unknown,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const payout = await tx.astrologerPayout.findUnique({
          where: {
            id: payoutId,
          },
        });

        if (!payout) {
          return {
            success: true,
            ignored: true,
          };
        }

        /*
         * Never release earnings from an already completed
         * payout because this could enable double-withdraw.
         * A post-processed reversal must be reconciled
         * separately before making funds withdrawable again.
         */
        if (payout.status === AstrologerPayoutStatus.COMPLETED) {
          await tx.astrologerPayout.update({
            where: {
              id: payout.id,
            },
            data: {
              providerStatus,
              providerStatusDetails: this.toJson(statusDetails),
              lastWebhookAt: new Date(),
              failureReason,
            },
          });

          return {
            success: true,
            status: 'COMPLETED_REQUIRES_REVERSAL_RECONCILIATION',
          };
        }

        if (payout.status === AstrologerPayoutStatus.FAILED) {
          return {
            success: true,
            duplicate: true,
          };
        }

        await tx.astrologerEarning.updateMany({
          where: {
            payoutId: payout.id,
            status: AstrologerEarningStatus.AVAILABLE,
          },
          data: {
            payoutId: null,
          },
        });

        await tx.astrologerPayout.update({
          where: {
            id: payout.id,
          },
          data: {
            status: AstrologerPayoutStatus.FAILED,
            providerReference,
            providerStatus,
            providerStatusDetails: this.toJson(statusDetails),
            failureReason,
            lastWebhookAt: new Date(),
          },
        });

        return {
          success: true,
          status: 'FAILED',
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
