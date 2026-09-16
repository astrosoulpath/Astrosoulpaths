import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AiAstroService } from './ai-astro.service';

@Injectable()
export class AiAstroExpiryProcessor {
  private static readonly STALE_RESERVATION_MINUTES = 15;
  private readonly logger = new Logger(AiAstroExpiryProcessor.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiAstroService: AiAstroService,
  ) {}

  private async cleanupStaleReservations(now: Date): Promise<void> {
    const staleBefore = new Date(
      now.getTime() - AiAstroExpiryProcessor.STALE_RESERVATION_MINUTES * 60_000,
    );

    const staleSessions = await this.prisma.aiAstroSession.findMany({
      where: {
        status: {
          in: ['PENDING', 'READY'],
        },
        createdAt: {
          lte: staleBefore,
        },
        endedAt: null,
      },
      select: {
        id: true,
        userId: true,
        clientSessionId: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 100,
    });

    for (const session of staleSessions) {
      try {
        const user = await this.prisma.user.findUnique({
          where: {
            id: session.userId,
          },
          select: {
            supabaseId: true,
          },
        });

        if (!user?.supabaseId) {
          this.logger.error(
            `AI Astro stale reservation skipped; Supabase user missing: ${session.id}`,
          );
          continue;
        }

        await this.aiAstroService.endSession(user.supabaseId, {
          clientSessionId: session.clientSessionId,
        });

        this.logger.log(
          `AI Astro stale ${session.status} reservation cancelled and released: ${session.id}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (message.includes('AI_ASTRO_SESSION_ALREADY_SETTLED')) {
          continue;
        }

        this.logger.error(
          `Failed to clean stale AI Astro reservation ${session.id}: ${message}`,
        );
      }
    }
  }
  @Cron(CronExpression.EVERY_10_SECONDS)
  async settleExpiredSessions(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const now = new Date();

      await this.cleanupStaleReservations(now);

      const activeSessions = await this.prisma.aiAstroSession.findMany({
        where: {
          status: 'ACTIVE',
          endedAt: null,
        },
        select: {
          id: true,
          userId: true,
          clientSessionId: true,
          startedAt: true,
          durationMinutes: true,
        },
        orderBy: {
          startedAt: 'asc',
        },
        take: 100,
      });

      for (const session of activeSessions) {
        const expiresAtMs =
          session.startedAt.getTime() + session.durationMinutes * 60_000;

        if (expiresAtMs > now.getTime()) {
          continue;
        }

        try {
          const user = await this.prisma.user.findUnique({
            where: {
              id: session.userId,
            },
            select: {
              supabaseId: true,
            },
          });

          if (!user?.supabaseId) {
            this.logger.error(
              `AI Astro expiry skipped; Supabase user missing: ${session.id}`,
            );
            continue;
          }

          await this.aiAstroService.endSession(user.supabaseId, {
            clientSessionId: session.clientSessionId,
          });

          this.logger.log(
            `AI Astro session auto-settled after purchased duration: ${session.id}`,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);

          if (message.includes('AI_ASTRO_SESSION_ALREADY_SETTLED')) {
            continue;
          }

          this.logger.error(
            `Failed to auto-settle AI Astro session ${session.id}: ${message}`,
          );
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}
