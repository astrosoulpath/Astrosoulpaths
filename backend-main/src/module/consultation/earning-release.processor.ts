import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AstrologerEarningStatus } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class EarningReleaseProcessor {
  private readonly logger = new Logger(EarningReleaseProcessor.name);
  private isRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async releaseEligibleEarnings(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const result = await this.prisma.astrologerEarning.updateMany({
        where: {
          status: AstrologerEarningStatus.PENDING,
          availableAt: {
            lte: new Date(),
          },
          reversedAt: null,
          paidAt: null,
        },
        data: {
          status: AstrologerEarningStatus.AVAILABLE,
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `Released ${result.count} pending astrologer earning(s)`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`Failed to release earnings: ${message}`);
    } finally {
      this.isRunning = false;
    }
  }
}