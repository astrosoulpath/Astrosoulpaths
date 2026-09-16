import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ConsultationService } from './consultation.service';

@Injectable()
export class ConsultationExpiryProcessor {
  private readonly logger = new Logger(ConsultationExpiryProcessor.name);

  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly consultationService: ConsultationService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async completeExpiredConsultations(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const expiredPendingConsultations =
        await this.prisma.callSession.findMany({
          where: {
            status: 'PENDING',
            endedAt: null,
            expiresAt: {
              lte: new Date(),
            },
          },
          select: {
            id: true,
          },
          orderBy: {
            expiresAt: 'asc',
          },
          take: 50,
        });

      for (const consultation of expiredPendingConsultations) {
        try {
          await this.consultationService.expirePendingConsultation(
            consultation.id,
          );

          this.logger.log(
            `Pending consultation auto-expired: ${consultation.id}`,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);

          this.logger.error(
            `Failed to auto-expire pending consultation ${consultation.id}: ${message}`,
          );
        }
      }

      const expiredConsultations = await this.prisma.callSession.findMany({
        where: {
          status: 'ACTIVE',
          endedAt: null,
          expiresAt: {
            lte: new Date(),
          },
        },
        select: {
          id: true,
          userId: true,
        },
        orderBy: {
          expiresAt: 'asc',
        },
        take: 50,
      });

      for (const consultation of expiredConsultations) {
        try {
          await this.consultationService.completeConsultation({
            consultationId: consultation.id,
            requestedByUserId: consultation.userId,
          });

          this.logger.log(
            `Expired consultation auto-completed: ${consultation.id}`,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);

          this.logger.error(
            `Failed to auto-complete consultation ${consultation.id}: ${message}`,
          );
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}
