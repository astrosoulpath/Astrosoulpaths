import { createHash } from 'crypto';

export type SubscriptionRole = 'CUSTOMER' | 'ASTROLOGER';
export type ReminderPreference = {
  pushEnabled: boolean;
  timezone: string;
  quietStart: number;
  quietEnd: number;
};
export type ReminderJob = {
  id: string;
  subscriptionId: string;
  userId: string;
  roleContext: SubscriptionRole;
  expiresAt: Date;
  milestone: number;
  deviceId: string;
  attempts: number;
};
export type ReminderInboxRow = {
  id: string;
  subscriptionId: string;
  expiresAt: Date;
  milestone: number;
  readAt: Date | null;
  createdAt: Date;
  state: string;
};
export const DAY_MS = 86_400_000;
export const EXPIRY_PRODUCTS = {
  CUSTOMER: {
    plan: 'DAILY_HOROSCOPE_MONTHLY',
    title: 'Personalized Daily Horoscope',
    price: '1',
    currency: 'USD',
    days: 30,
    renewal: '/horoscope/subscription',
  },
  ASTROLOGER: {
    plan: 'ASTROLOGER_KUNDLI_YEARLY',
    title: 'Professional Kundli',
    price: '3500',
    currency: 'INR',
    days: 365,
    renewal: '/subscriptions',
  },
} as const;

/** No calendar-month arithmetic: periods are exact elapsed 24-hour days. */
export function expiryMilestone(expiry: Date, now: Date): number | null {
  const remaining = expiry.getTime() - now.getTime();
  if (
    !Number.isFinite(remaining) ||
    remaining > 7 * DAY_MS ||
    remaining <= -DAY_MS
  )
    return null;
  return Math.max(0, Math.ceil(remaining / DAY_MS));
}
export function expiryEventId(
  subscriptionId: string,
  expiry: Date,
  role: SubscriptionRole,
  milestone: number,
) {
  return createHash('sha256')
    .update(
      JSON.stringify([subscriptionId, expiry.toISOString(), role, milestone]),
    )
    .digest('hex');
}
export function validSubscriptionPeriod(
  subscription: {
    startDate: Date | null;
    endDate: Date | null;
    amount: unknown;
    currency: string;
  },
  role: SubscriptionRole,
) {
  const product = EXPIRY_PRODUCTS[role];
  return (
    !!subscription.startDate &&
    !!subscription.endDate &&
    subscription.endDate.getTime() - subscription.startDate.getTime() ===
      product.days * DAY_MS &&
    Number(subscription.amount) === Number(product.price) &&
    subscription.currency === product.currency
  );
}
export function withinReminderHours(
  now: Date,
  timezone: string,
  start: number,
  end: number,
) {
  const hour = Number(
    new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  );
  // start/end describe quiet hours. Equal means no quiet hours.
  return (
    start === end ||
    !(start < end ? hour >= start && hour < end : hour >= start || hour < end)
  );
}
export function expiryCopy(role: SubscriptionRole, milestone: number) {
  const product = EXPIRY_PRODUCTS[role];
  return {
    title: 'Astro Soul Path ✨',
    body: `${product.title} ${milestone === 0 ? 'has expired' : `expires in ${milestone} day${milestone === 1 ? '' : 's'}`}. Renew for ${role === 'CUSTOMER' ? '$1' : '₹3,500'}. No automatic charge.`,
  };
}
export function expirySchemaReady() {
  return process.env.SUBSCRIPTION_EXPIRY_SCHEMA_READY === 'true';
}
export function expirySchedulerEnabled() {
  return (
    expirySchemaReady() &&
    process.env.SUBSCRIPTION_EXPIRY_SCHEDULER_ENABLED === 'true'
  );
}
export function expiryPushEnabled() {
  return (
    expirySchedulerEnabled() &&
    process.env.SUBSCRIPTION_EXPIRY_PUSH_ENABLED === 'true' &&
    process.env.SUBSCRIPTION_EXPIRY_POLICY_APPROVED === 'true'
  );
}
