import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsPushService } from '../notifications/notifications.push.service';
import { horoscopeOutboxEnabled } from './horoscope-durable.store';
import { DAILY_PLAN } from './daily-horoscope-policy';
import { validateHoroscopeText } from './horoscope-localization';
import { horoscopeReminderCopy } from './horoscope-reminder-copy';
import { notificationLocalDate } from '../notifications/notification-local-date';
import { horoscopeQuietHours, nextHoroscopeWindow } from './horoscope-delivery-policy';

type Job = {
  id: string;
  userId: string;
  subscriptionId: string;
  readingId: string;
  deviceId: string;
  locale: string;
  attempts: number;
  leaseToken: string;
};
@Injectable()
export class HoroscopeOutboxWorker {
  constructor(
    private readonly db: PrismaService,
    private readonly push: NotificationsPushService,
  ) {}

  @Cron('*/30 * * * * *')
  async tick() {
    if (!horoscopeOutboxEnabled()) return;
    await this.db
      .$executeRaw`UPDATE public."HoroscopeNotificationOutbox" SET "state"='FAILED',"failureCode"='MAX_ATTEMPTS',"updatedAt"=CURRENT_TIMESTAMP
      WHERE "state"='PROCESSING' AND "leaseUntil"<CURRENT_TIMESTAMP AND "attempts">=5`;
    // A crashed sender may already have reached FCM. Never blindly resend it.
    await this.db
      .$executeRaw`UPDATE public."HoroscopeNotificationOutbox" SET "state"='UNKNOWN',"failureCode"='ACCEPTANCE_UNKNOWN',"updatedAt"=CURRENT_TIMESTAMP
      WHERE "state"='SENDING' AND "leaseUntil"<CURRENT_TIMESTAMP`;
    const token = randomUUID();
    const jobs = await this.db.$queryRaw<Job[]>`WITH candidates AS (
      SELECT "id" FROM public."HoroscopeNotificationOutbox"
      WHERE "attempts"<5 AND "scheduledAt"<=CURRENT_TIMESTAMP AND "nextAttemptAt"<=CURRENT_TIMESTAMP AND
        ("state" IN ('QUEUED','RETRY') OR ("state"='PROCESSING' AND "leaseUntil"<CURRENT_TIMESTAMP))
      ORDER BY "nextAttemptAt","id" FOR UPDATE SKIP LOCKED LIMIT 20
    ) UPDATE public."HoroscopeNotificationOutbox" o SET "state"='PROCESSING',"attempts"=o."attempts"+1,
      "leaseToken"=${token},"leaseUntil"=CURRENT_TIMESTAMP + interval '2 minutes',"updatedAt"=CURRENT_TIMESTAMP
      FROM candidates c WHERE o."id"=c."id" RETURNING o.*`;
    for (const job of jobs) {
      try {
        await this.deliver(job);
      } catch {
        await this.finish(job, 'UNKNOWN', 'ACCEPTANCE_OR_WORKER_FAILURE');
      }
    }
  }

  private async deliver(job: Job) {
    const rows = await this.db.$queryRaw<
      Array<{ response: any; localDate: string; timezone: string }>
    >`SELECT "response","localDate"::text,"timezone" FROM public."PersonalizedHoroscopeReading"
      WHERE "id"=${job.readingId} AND "userId"=${job.userId} AND "locale"=${job.locale} AND "state"='READY'`;
    const ai = rows[0]?.response?.data?.ai;
    if (!ai) return this.finish(job, 'FAILED', 'READING_MISSING');
    try {
      if (rows[0].localDate !== notificationLocalDate(rows[0].timezone))
        return this.finish(job, 'CANCELLED', 'READING_EXPIRED');
    } catch { return this.finish(job, 'FAILED', 'READING_TIMEZONE_INVALID'); }
    // Before-08 jobs wait until the same day's window. After-22 jobs cannot be
    // sent tomorrow as today's reading; cancel instead of delivering stale data.
    try {
      const now = new Date();
      if (horoscopeQuietHours(rows[0].timezone, now)) {
        const next = nextHoroscopeWindow(rows[0].timezone, now);
        if (notificationLocalDate(rows[0].timezone, next) !== rows[0].localDate)
          return this.finish(job, 'CANCELLED', 'QUIET_WINDOW_CLOSED');
        return this.finish(job, 'RETRY', 'QUIET_HOURS', {}, next);
      }
    } catch { return this.finish(job, 'FAILED', 'READING_TIMEZONE_INVALID'); }
    const title = ai.notificationTitle,
      body = ai.shortReading;
    try {
      validateHoroscopeText(job.locale, [title, body]);
    } catch {
      return this.finish(job, 'FAILED', 'LOCALIZATION_FAILED');
    }
    const preference = await this.db.$queryRaw<
      Array<{ enabled: boolean }>
    >`SELECT "enabled" FROM public."HoroscopeNotificationPreference" WHERE "userId"=${job.userId}`;
    if (preference[0]?.enabled !== true)
      return this.finish(job, 'CANCELLED', 'PREFERENCE_DISABLED');
    const device = await this.db.pushDevice.findFirst({
      where: { id: job.deviceId, userId: job.userId, isActive: true },
      select: { id: true },
    });
    if (!device) return this.finish(job, 'CANCELLED', 'DEVICE_DISABLED');
    const subscription = await this.db.subscription.findFirst({
      where: {
        id: job.subscriptionId,
        userId: job.userId,
        subscriptionStatus: 'ACTIVE',
        startDate: { lte: new Date() },
        endDate: { gt: new Date() },
        subscriptionPlan: { name: DAILY_PLAN, isActive: true },
        user: { isActive: true, isBlocked: false, userProfile: {
          lang: {equals:job.locale,mode:'insensitive'},
          // A timezone change invalidates a queued reading's delivery window.
          ...(/^-?\d+(?:\.\d+)?$/.test(rows[0].timezone)
            ? { timezone: Number(rows[0].timezone), OR: [{timezoneName:null},{timezoneName:''}] }
            : { timezoneName: rows[0].timezone }),
        } },
      },
      select: { endDate: true },
    });
    if (!subscription?.endDate)
      return this.finish(job, 'CANCELLED', 'ENTITLEMENT_EXPIRED');
    const sending = await this.db
      .$executeRaw`UPDATE public."HoroscopeNotificationOutbox" SET "state"='SENDING',"updatedAt"=CURRENT_TIMESTAMP
      WHERE "id"=${job.id} AND "leaseToken"=${job.leaseToken} AND "state"='PROCESSING' AND "leaseUntil">CURRENT_TIMESTAMP`;
    if (sending !== 1) return;
    const result = await this.push.sendToUser(
      job.userId,
      {
        ...horoscopeReminderCopy(job.locale),
        expiresAt: subscription.endDate,
        data: {
          type: 'horoscope',
          screen: 'horoscope',
          locale: job.locale,
          readingId: job.readingId,
          deliveryId: job.id,
          ownerId:job.userId,
        },
      },
      job.deviceId,
    );
    if (result.sent === 1)
      return this.finish(job, 'ACCEPTED', null, { accepted: 1 });
    // Retry only failures known to precede acceptance. Uncertain sends require reconciliation.
    if (!result.configured)
      return this.finish(
        job,
        job.attempts >= 5 ? 'FAILED' : 'RETRY',
        'FCM_NOT_CONFIGURED',
      );
    const codes = result.failureCodes ?? [];
    if (codes.length && codes.every(code => [
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
    ].includes(code))) return this.finish(job, 'FAILED', 'FCM_DEVICE_INVALID');
    if (
      codes.length &&
      codes.every((code) =>
        ['messaging/quota-exceeded', 'messaging/server-unavailable'].includes(
          code,
        ),
      )
    ) {
      return this.finish(
        job,
        job.attempts >= 5 ? 'FAILED' : 'RETRY',
        'FCM_TRANSIENT',
      );
    }
    return this.finish(job, 'UNKNOWN', 'FCM_ACCEPTANCE_UNKNOWN');
  }

  private async finish(
    job: Job,
    state: string,
    code: string | null,
    response: object = {},
    retryNotBefore?: Date,
  ) {
    const retryAt = retryNotBefore ?? new Date(
      Date.now() + Math.min(900, 30 * 2 ** Math.min(job.attempts, 5)) * 1000,
    );
    await this.db
      .$executeRaw`UPDATE public."HoroscopeNotificationOutbox" SET "state"=${state},"failureCode"=${code},
      "providerResponse"=${JSON.stringify(response)}::jsonb,"nextAttemptAt"=${retryAt},"acceptedAt"=CASE WHEN ${state}='ACCEPTED' THEN CURRENT_TIMESTAMP ELSE "acceptedAt" END,
      "leaseToken"=NULL,"leaseUntil"=NULL,"updatedAt"=CURRENT_TIMESTAMP
      WHERE "id"=${job.id} AND "leaseToken"=${job.leaseToken} AND "state" IN ('PROCESSING','SENDING') AND "leaseUntil">CURRENT_TIMESTAMP`;
  }
}
