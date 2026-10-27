import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsPushService } from '../notifications/notifications.push.service';
import { supportOperationsEnabled } from './support-operations';

export function supportDeliveryEnabled() {
  const kill = process.env.SUPPORT_NOTIFICATIONS_EMERGENCY_DISABLED;
  return (
    supportOperationsEnabled() &&
    process.env.SUPPORT_NOTIFICATIONS_ENABLED === 'true' &&
    (kill === undefined || kill === 'false')
  );
}
@Injectable()
export class SupportDeliveryWorker {
  constructor(
    private readonly db: PrismaService,
    private readonly push: NotificationsPushService,
  ) {}
  @Cron('*/30 * * * * *')
  async tick() {
    if (!supportDeliveryEnabled()) return;
    await this.db
      .$executeRaw`UPDATE public."SupportDelivery" SET "state"=CASE WHEN "state"='SENDING' THEN 'UNKNOWN' ELSE 'QUEUED' END,"leaseToken"=NULL,"leaseUntil"=NULL WHERE "state" IN ('PROCESSING','SENDING') AND "leaseUntil"<CURRENT_TIMESTAMP`;
    const lease = randomUUID();
    const jobs = await this.db.$queryRaw<
      any[]
    >`WITH due AS (SELECT "id" FROM public."SupportDelivery" WHERE "state"='QUEUED' AND "attempts"<5 AND "nextAttemptAt"<=CURRENT_TIMESTAMP ORDER BY "createdAt","id" FOR UPDATE SKIP LOCKED LIMIT 10) UPDATE public."SupportDelivery" d SET "state"='PROCESSING',"leaseToken"=${lease},"leaseUntil"=CURRENT_TIMESTAMP+interval '2 minutes' FROM due WHERE d."id"=due."id" RETURNING d.*`;
    for (const job of jobs) {
      try {
        await this.deliver(job);
      } catch {
        await this.finish(job, 'UNKNOWN');
      }
    }
  }
  private async deliver(job: any) {
    if (!supportDeliveryEnabled()) return this.finish(job, 'CANCELLED');
    const ticket = await this.db.supportTicket.findFirst({
      where: {
        id: job.ticketId,
        customerId: job.ownerId,
        customer: { is: { isActive: true, isBlocked: false } },
      },
      select: { id: true },
    });
    const expiresAt = new Date(new Date(job.createdAt).getTime() + 86400000);
    if (!ticket || expiresAt.getTime() <= Date.now())
      return this.finish(job, 'CANCELLED');
    const acquired = await this.db
      .$executeRaw`UPDATE public."SupportDelivery" SET "state"='SENDING',"attempts"="attempts"+1 WHERE "id"=${job.id} AND "leaseToken"=${job.leaseToken} AND "state"='PROCESSING' AND "leaseUntil">CURRENT_TIMESTAMP`;
    if (acquired !== 1) return;
    const result = await this.push.sendToUser(
      job.ownerId,
      {
        title: 'Support update',
        body: 'Open Astro Soul Path to view your support request securely.',
        expiresAt,
        data: {
          type: 'support_ticket',
          ticketId: job.ticketId,
          ownerId: job.ownerId,
          deliveryId: job.id,
          expiresAt: expiresAt.toISOString(),
        },
      },
      undefined,
      true,
    );
    if (result.configured && result.sent > 0 && result.failed === 0)
      return this.finish(job, 'ACCEPTED');
    const retry =
      !result.configured ||
      (result.sent === 0 &&
        result.failureCodes?.length &&
        result.failureCodes.every((code) =>
          ['messaging/quota-exceeded', 'messaging/server-unavailable'].includes(
            code,
          ),
        ));
    return this.finish(
      job,
      retry ? (job.attempts >= 4 ? 'FAILED' : 'QUEUED') : 'UNKNOWN',
    );
  }
  private async finish(job: any, state: string) {
    const next = new Date(
      Date.now() +
        Math.min(900, 30 * 2 ** Math.min(job.attempts + 1, 5)) * 1000,
    );
    await this.db
      .$executeRaw`UPDATE public."SupportDelivery" SET "state"=${state},"nextAttemptAt"=${next},"leaseToken"=NULL,"leaseUntil"=NULL WHERE "id"=${job.id} AND "leaseToken"=${job.leaseToken} AND "state" IN ('PROCESSING','SENDING') AND "leaseUntil">CURRENT_TIMESTAMP`;
  }
}
