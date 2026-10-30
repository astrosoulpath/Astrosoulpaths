import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsPushService } from './notifications.push.service';
import {
  DAY_MS,
  EXPIRY_PRODUCTS,
  SubscriptionRole,
  ReminderPreference,
  ReminderJob,
  expiryEventId,
  expiryMilestone,
  expiryPushEnabled,
  expirySchedulerEnabled,
  validSubscriptionPeriod,
  withinReminderHours,
} from './subscription-expiry.policy';

@Injectable()
export class SubscriptionExpiryWorker {
  private readonly logger = new Logger(SubscriptionExpiryWorker.name);
  private busy = false;
  constructor(
    private readonly db: PrismaService,
    private readonly push: NotificationsPushService,
  ) {}

  @Cron('*/30 * * * * *')
  async tick() {
    if (!expirySchedulerEnabled() || this.busy) return;
    this.busy = true;
    try {
      const [{ now }] = await this.db.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AS "now"`;
      // Never reinterpret an ambiguous provider timeout as a safe retry.
      await this.db
        .$executeRaw`WITH changed AS (UPDATE "SubscriptionExpiryReminder" SET "state"='UNKNOWN',"lastCode"='ACCEPTANCE_UNKNOWN',"updatedAt"=CURRENT_TIMESTAMP WHERE "state"='SENDING' AND "leaseUntil"<CURRENT_TIMESTAMP RETURNING "id") INSERT INTO "SubscriptionReminderAudit" ("reminderId","state","code") SELECT "id",'UNKNOWN','ACCEPTANCE_UNKNOWN' FROM changed`;
      // Renewal/refund/cancellation makes queued reminders obsolete, including inbox notices.
      await this.db
        .$executeRaw`WITH changed AS (UPDATE "SubscriptionExpiryReminder" r SET "state"='CANCELLED',"lastCode"='PERIOD_OBSOLETE',"updatedAt"=CURRENT_TIMESTAMP WHERE r."state" IN ('PENDING','INBOX') AND NOT EXISTS (SELECT 1 FROM "Subscription" s WHERE s."id"=r."subscriptionId" AND s."userId"=r."userId" AND (s."endDate" AT TIME ZONE 'UTC')=r."expiresAt" AND s."subscriptionStatus" IN ('ACTIVE','EXPIRED') AND NOT EXISTS (SELECT 1 FROM "Subscription" n WHERE n."userId"=s."userId" AND n."subscriptionPlanId"=s."subscriptionPlanId" AND n."subscriptionStatus"='ACTIVE' AND n."endDate">s."endDate")) RETURNING r."id") INSERT INTO "SubscriptionReminderAudit" ("reminderId","state","code") SELECT "id",'CANCELLED','PERIOD_OBSOLETE' FROM changed`;
      // Cursor pagination prevents a large installation starving later owners.
      let cursor: string | undefined;
      while (true) {
        const subscriptions = await this.db.subscription.findMany({
          where: {
            subscriptionStatus: { in: ['ACTIVE', 'EXPIRED'] },
            startDate: { lte: now },
            endDate: {
              gt: new Date(now.getTime() - DAY_MS),
              lte: new Date(now.getTime() + 7 * DAY_MS),
            },
            subscriptionPlan: {
              name: {
                in: [
                  EXPIRY_PRODUCTS.CUSTOMER.plan,
                  EXPIRY_PRODUCTS.ASTROLOGER.plan,
                ],
              },
            },
            user: { isActive: true, isBlocked: false },
          },
          include: {
            subscriptionPlan: true,
            user: { include: { role: true, astrologer: true } },
          },
          orderBy: { id: 'asc' },
          take: 100,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        for (const subscription of subscriptions) {
          const role: SubscriptionRole =
            subscription.subscriptionPlan?.name ===
            EXPIRY_PRODUCTS.CUSTOMER.plan
              ? 'CUSTOMER'
              : 'ASTROLOGER';
          const canonical = subscription.user.role?.name?.toUpperCase();
          if (
            role === 'CUSTOMER'
              ? subscription.user.isAstrologer ||
                !['USER', 'CUSTOMER'].includes(canonical || '')
              : !subscription.user.isAstrologer ||
                canonical !== 'ASTROLOGER' ||
                !subscription.user.astrologer?.isApproved
          )
            continue;
          if (
            !subscription.subscriptionPlan?.isActive ||
            !validSubscriptionPeriod(subscription, role) ||
            !subscription.endDate ||
            !subscription.razorpayPaymentId ||
            !subscription.razorpayOrderId
          )
            continue;
          // Read existing captured/fulfilled order only; never contact paid providers.
          const verified = await this.db.paymentOrder.findFirst({
            where: {
              userId: subscription.userId,
              razorpayOrderId: subscription.razorpayOrderId,
              razorpayPaymentId: subscription.razorpayPaymentId,
              status: 'SUCCESS',
              amount: subscription.amount!,
              currency: subscription.currency,
            },
          });
          if (!verified) continue;
          const renewed = await this.db.subscription.findFirst({
            where: {
              userId: subscription.userId,
              subscriptionPlanId: subscription.subscriptionPlanId,
              subscriptionStatus: 'ACTIVE',
              endDate: { gt: subscription.endDate },
            },
            select: { id: true },
          });
          if (renewed) continue;
          const milestone = expiryMilestone(subscription.endDate, now);
          if (milestone === null) continue;
          const event = expiryEventId(
            subscription.id,
            subscription.endDate,
            role,
            milestone,
          );
          await this.insert(
            event,
            subscription.id,
            subscription.userId,
            role,
            subscription.endDate,
            milestone,
            'INBOX',
            '',
          );
          // Absence of a registered phone never removes the authenticated inbox record.
          if (!expiryPushEnabled()) continue;
          const prefs = await this.db.$queryRaw<
            ReminderPreference[]
          >`SELECT * FROM "SubscriptionReminderPreference" WHERE "userId"=${subscription.userId} AND "roleContext"=${role} AND "pushEnabled"=true`;
          const pref = prefs[0];
          if (
            !pref ||
            !withinReminderHours(
              now,
              pref.timezone,
              pref.quietStart,
              pref.quietEnd,
            )
          )
            continue;
          const devices = await this.db.$queryRaw<
            { id: string }[]
          >`SELECT DISTINCT COALESCE("deviceId","id") AS "id" FROM "PushDevice" WHERE "userId"=${subscription.userId} AND "subscriptionRole"=${role} AND "isActive"=true AND "platform" IN ('ANDROID','IOS')`;
          for (const device of devices)
            await this.insert(
              event + ':' + device.id,
              subscription.id,
              subscription.userId,
              role,
              subscription.endDate,
              milestone,
              'PUSH',
              device.id,
            );
        }
        if (subscriptions.length < 100) break;
        cursor = subscriptions[subscriptions.length - 1].id;
      }
      if (expiryPushEnabled()) await this.deliver(now);
    } catch {
      this.logger.error(
        'Subscription expiry cycle failed; no automatic activation or fallback delivery',
      );
    } finally {
      this.busy = false;
    }
  }
  private async insert(
    id: string,
    subscriptionId: string,
    userId: string,
    role: SubscriptionRole,
    expiry: Date,
    milestone: number,
    channel: string,
    deviceId: string,
  ) {
    await this.db.$transaction(async (tx) => {
      const inserted =
        await tx.$executeRaw`INSERT INTO "SubscriptionExpiryReminder" ("id","subscriptionId","userId","roleContext","expiresAt","milestone","channel","deviceId","state") VALUES (${id},${subscriptionId},${userId},${role},${expiry},${milestone},${channel},${deviceId},${channel === 'INBOX' ? 'INBOX' : 'PENDING'}) ON CONFLICT DO NOTHING`;
      if (inserted)
        await tx.$executeRaw`INSERT INTO "SubscriptionReminderAudit" ("reminderId","state","code") VALUES (${id},${channel === 'INBOX' ? 'INBOX' : 'PENDING'},'MILESTONE_CREATED')`;
    });
  }
  private async deliver(now: Date) {
    // Atomic claim across multiple worker instances. Each provider attempt has its own durable lease.
    const jobs = await this.db.$queryRaw<
      ReminderJob[]
    >`WITH candidates AS (SELECT "id" FROM "SubscriptionExpiryReminder" WHERE "channel"='PUSH' AND "state"='PENDING' AND "attempts"<5 AND "nextAttemptAt"<=CURRENT_TIMESTAMP ORDER BY "nextAttemptAt" FOR UPDATE SKIP LOCKED LIMIT 10) UPDATE "SubscriptionExpiryReminder" r SET "state"='SENDING',"attempts"="attempts"+1,"leaseUntil"=CURRENT_TIMESTAMP+INTERVAL '5 minutes',"updatedAt"=CURRENT_TIMESTAMP FROM candidates c WHERE r."id"=c."id" RETURNING r.*`;
    for (const job of jobs) {
      await this.db
        .$executeRaw`INSERT INTO "SubscriptionReminderAudit" ("reminderId","state","code") VALUES (${job.id},'SENDING','LEASE_CLAIMED')`;
      const subscription = await this.db.subscription.findUnique({
        where: { id: job.subscriptionId },
        include: {
          user: { include: { role: true, astrologer: true } },
          subscriptionPlan: true,
        },
      });
      const role = job.roleContext;
      const newer =
        subscription &&
        (await this.db.subscription.findFirst({
          where: {
            userId: job.userId,
            subscriptionPlanId: subscription.subscriptionPlanId,
            subscriptionStatus: 'ACTIVE',
            endDate: { gt: subscription.endDate! },
          },
          select: { id: true },
        }));
      const pref = (
        await this.db.$queryRaw<
          ReminderPreference[]
        >`SELECT * FROM "SubscriptionReminderPreference" WHERE "userId"=${job.userId} AND "roleContext"=${role} AND "pushEnabled"=true`
      )[0];
      const paid =
        subscription?.razorpayOrderId &&
        subscription.razorpayPaymentId &&
        (await this.db.paymentOrder.findFirst({
          where: {
            userId: job.userId,
            razorpayOrderId: subscription.razorpayOrderId,
            razorpayPaymentId: subscription.razorpayPaymentId,
            status: 'SUCCESS',
            amount: subscription.amount!,
            currency: subscription.currency,
          },
          select: { id: true },
        }));
      const currentRole = subscription?.user.role?.name?.toUpperCase();
      const validRole =
        role === 'CUSTOMER'
          ? ['USER', 'CUSTOMER'].includes(currentRole || '') &&
            !subscription?.user.isAstrologer
          : currentRole === 'ASTROLOGER' &&
            subscription?.user.isAstrologer &&
            subscription?.user.astrologer?.isApproved;
      let state = 'CANCELLED',
        code = 'PERIOD_OR_CONSENT_CHANGED';
      if (
        subscription?.endDate &&
        paid &&
        subscription.userId === job.userId &&
        subscription.user.isActive &&
        !subscription.user.isBlocked &&
        validRole &&
        subscription.subscriptionPlan?.isActive &&
        subscription.subscriptionPlan?.name === EXPIRY_PRODUCTS[role]?.plan &&
        validSubscriptionPeriod(subscription, role) &&
        ['ACTIVE', 'EXPIRED'].includes(subscription.subscriptionStatus) &&
        subscription.endDate.getTime() === job.expiresAt.getTime() &&
        expiryMilestone(subscription.endDate, now) === job.milestone &&
        !newer &&
        pref
      ) {
        if (
          !withinReminderHours(
            now,
            pref.timezone,
            pref.quietStart,
            pref.quietEnd,
          )
        ) {
          state = 'PENDING';
          code = 'QUIET_HOURS';
        } else {
          try {
            const result = await this.push.sendSubscriptionReminder(
              job.userId,
              job.deviceId,
              role,
              job.id,
              job.subscriptionId,
              new Date(
                job.expiresAt.getTime() +
                  (job.milestone === 0
                    ? DAY_MS
                    : -(job.milestone - 1) * DAY_MS),
              ),
            );
            state =
              result === 'ACCEPTED'
                ? 'ACCEPTED'
                : result.startsWith('RETRY_')
                  ? job.attempts >= 5
                    ? 'FAILED'
                    : 'PENDING'
                  : 'CANCELLED';
            code = result;
          } catch {
            state = 'UNKNOWN';
            code = 'PROVIDER_ACCEPTANCE_UNKNOWN';
          }
        }
      }
      await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE "SubscriptionExpiryReminder" SET "state"=${state},"lastCode"=${code},"attempts"="attempts"-CASE WHEN ${code}='QUIET_HOURS' THEN 1 ELSE 0 END,"leaseUntil"=NULL,"nextAttemptAt"=CURRENT_TIMESTAMP+INTERVAL '15 minutes',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${job.id} AND "state"='SENDING'`;
        await tx.$executeRaw`INSERT INTO "SubscriptionReminderAudit" ("reminderId","state","code") VALUES (${job.id},${state},${code})`;
      });
    }
  }
}
