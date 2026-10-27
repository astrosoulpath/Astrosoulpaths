import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const DAILY_PLAN = 'DAILY_HOROSCOPE_MONTHLY';
export const DAILY_DAYS = 30;
export const DAILY_USD_PRICE = new Prisma.Decimal(1);
export function exactPeriodEnd(start: Date, days: number): Date {
  if (!Number.isInteger(days) || days <= 0 || days > 3660)
    throw new BadRequestException('Invalid subscription duration');
  return new Date(start.getTime() + days * 86400000);
}
export function assertDailyPlan(plan: {
  name: string;
  price: Prisma.Decimal;
  currency: string;
  durationDays: number;
}) {
  if (
    plan.name === DAILY_PLAN &&
    (!new Prisma.Decimal(plan.price).eq(DAILY_USD_PRICE) ||
      plan.currency !== 'USD' ||
      plan.durationDays !== DAILY_DAYS)
  ) {
    throw new ServiceUnavailableException(
      'Personalized horoscope plan requires verified USD 1 / 30-day configuration',
    );
  }
}
export function assertDailyCheckoutAvailable(planName: string) {
  if (
    planName === DAILY_PLAN &&
    process.env.PERSONALIZED_HOROSCOPE_PAYMENTS_ENABLED !== 'true'
  ) {
    throw new ServiceUnavailableException(
      'Personalized horoscope checkout is disabled pending merchant currency and payment approval',
    );
  }
}
