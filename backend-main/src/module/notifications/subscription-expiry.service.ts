import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  EXPIRY_PRODUCTS,
  SubscriptionRole,
  ReminderPreference,
  ReminderInboxRow,
  expiryCopy,
  expirySchemaReady,
  expiryPushEnabled,
  expirySchedulerEnabled,
  validSubscriptionPeriod,
} from './subscription-expiry.policy';

export type ExpiryIdentity = {
  asp_user_id?: string;
  asp_context?: string;
  asp_account_role?: string;
};
@Injectable()
export class SubscriptionExpiryService {
  constructor(private readonly prisma: PrismaService) {}

  async owner(identity: ExpiryIdentity) {
    if (!identity.asp_user_id)
      throw new ForbiddenException('Canonical account required');
    const user = await this.prisma.user.findUnique({
      where: { id: identity.asp_user_id },
      include: { role: true, astrologer: true, userProfile: true },
    });
    if (!user?.isActive || user.isBlocked)
      throw new ForbiddenException('Account unavailable');
    const context = String(
      identity.asp_context || identity.asp_account_role || '',
    ).toUpperCase();
    const canonical = user.role?.name?.toUpperCase();
    let role: SubscriptionRole;
    if (
      ['CUSTOMER', 'USER'].includes(context) &&
      ['USER', 'CUSTOMER'].includes(canonical || '') &&
      !user.isAstrologer
    )
      role = 'CUSTOMER';
    else if (
      context === 'ASTROLOGER' &&
      canonical === 'ASTROLOGER' &&
      user.isAstrologer &&
      user.astrologer?.isApproved
    )
      role = 'ASTROLOGER';
    else throw new ForbiddenException('Subscription role is not authorized');
    let timezone = user.userProfile?.timezoneName || 'UTC';
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
    } catch {
      timezone = 'UTC';
    }
    return { id: user.id, role, timezone };
  }
  async summary(identity: ExpiryIdentity) {
    const owner = await this.owner(identity),
      product = EXPIRY_PRODUCTS[owner.role],
      now = new Date();
    // Prefer an active paid period over a newer failed/pending checkout.
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId: owner.id, subscriptionPlan: { name: product.plan } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const subscription =
      subscriptions.find(
        (s) =>
          s.subscriptionStatus === 'ACTIVE' &&
          s.endDate &&
          s.endDate > now &&
          validSubscriptionPeriod(s, owner.role),
      ) ?? subscriptions[0];
    const paid =
      subscription?.razorpayOrderId &&
      subscription.razorpayPaymentId &&
      (await this.prisma.paymentOrder.findFirst({
        where: {
          userId: owner.id,
          razorpayOrderId: subscription.razorpayOrderId,
          razorpayPaymentId: subscription.razorpayPaymentId,
          status: 'SUCCESS',
          amount: subscription.amount!,
          currency: subscription.currency,
        },
        select: { id: true },
      }));
    const periodValid =
      !!subscription &&
      !!paid &&
      ['ACTIVE', 'EXPIRED'].includes(subscription.subscriptionStatus) &&
      validSubscriptionPeriod(subscription, owner.role);
    const [preferences, reminders, counts] = expirySchemaReady()
      ? await Promise.all([
          this.prisma.$queryRaw<
            ReminderPreference[]
          >`SELECT "pushEnabled","timezone","quietStart","quietEnd" FROM "SubscriptionReminderPreference" WHERE "userId"=${owner.id} AND "roleContext"=${owner.role}`,
          this.prisma.$queryRaw<
            ReminderInboxRow[]
          >`SELECT "id","subscriptionId","expiresAt","milestone","readAt","createdAt","state" FROM "SubscriptionExpiryReminder" WHERE "userId"=${owner.id} AND "roleContext"=${owner.role} AND "channel"='INBOX' AND "state"='INBOX' ORDER BY "createdAt" DESC LIMIT 100`,
          this.prisma.$queryRaw<
            { count: number }[]
          >`SELECT count(*)::int AS "count" FROM "SubscriptionExpiryReminder" WHERE "userId"=${owner.id} AND "roleContext"=${owner.role} AND "channel"='INBOX' AND "state"='INBOX' AND "readAt" IS NULL`,
        ])
      : [[], [], []];
    return {
      success: true,
      data: {
        ownerId: owner.id,
        roleContext: owner.role,
        product,
        serverNow: now.toISOString(),
        schemaReady: expirySchemaReady(),
        schedulerReady: expirySchedulerEnabled(),
        pushGateEnabled: expiryPushEnabled(),
        subscription: subscription
          ? {
              id: subscription.id,
              status:
                periodValid &&
                subscription.subscriptionStatus === 'ACTIVE' &&
                subscription.endDate! <= now
                  ? 'EXPIRED'
                  : subscription.subscriptionStatus,
              startDate: periodValid ? subscription.startDate : null,
              expiresAt: periodValid ? subscription.endDate : null,
              periodVerified: periodValid,
              automaticRenewal: false,
            }
          : null,
        preference: preferences[0] ?? {
          pushEnabled: false,
          timezone: owner.timezone,
          quietStart: 22,
          quietEnd: 8,
        },
        unreadCount: counts[0]?.count ?? 0,
        reminders: reminders.map((r) => ({
          ...r,
          ...expiryCopy(owner.role, r.milestone),
        })),
      },
    };
  }
  async preferences(
    identity: ExpiryIdentity,
    body: {
      pushEnabled?: unknown;
      timezone?: unknown;
      quietStart?: unknown;
      quietEnd?: unknown;
    },
  ) {
    const owner = await this.owner(identity);
    if (!expirySchemaReady())
      throw new ServiceUnavailableException(
        'Subscription reminder schema is not activated',
      );
    if (
      typeof body?.pushEnabled !== 'boolean' ||
      typeof body.timezone !== 'string' ||
      body.timezone.length > 100 ||
      !Number.isInteger(body.quietStart) ||
      !Number.isInteger(body.quietEnd) ||
      Number(body.quietStart) < 0 ||
      Number(body.quietStart) > 23 ||
      Number(body.quietEnd) < 0 ||
      Number(body.quietEnd) > 23
    )
      throw new BadRequestException(
        'Explicit consent, valid timezone and quiet hours are required',
      );
    try {
      new Intl.DateTimeFormat('en', { timeZone: body.timezone }).format();
    } catch {
      throw new BadRequestException('Invalid timezone');
    }
    await this.prisma
      .$executeRaw`INSERT INTO "SubscriptionReminderPreference" ("userId","roleContext","pushEnabled","timezone","quietStart","quietEnd") VALUES (${owner.id},${owner.role},${body.pushEnabled},${body.timezone},${Number(body.quietStart)},${Number(body.quietEnd)}) ON CONFLICT ("userId","roleContext") DO UPDATE SET "pushEnabled"=EXCLUDED."pushEnabled","timezone"=EXCLUDED."timezone","quietStart"=EXCLUDED."quietStart","quietEnd"=EXCLUDED."quietEnd","updatedAt"=CURRENT_TIMESTAMP`;
    return this.summary(identity);
  }
  async read(identity: ExpiryIdentity, id: string) {
    const owner = await this.owner(identity);
    if (!expirySchemaReady())
      throw new ServiceUnavailableException(
        'Subscription reminder schema is not activated',
      );
    const count = await this.prisma
      .$executeRaw`UPDATE "SubscriptionExpiryReminder" SET "readAt"=COALESCE("readAt",CURRENT_TIMESTAMP),"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "userId"=${owner.id} AND "roleContext"=${owner.role} AND "channel"='INBOX'`;
    if (!count) throw new NotFoundException('Reminder unavailable');
    return { success: true };
  }
}
