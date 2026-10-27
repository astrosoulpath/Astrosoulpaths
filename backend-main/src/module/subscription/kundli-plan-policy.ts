import { ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const KUNDLI_YEARLY_PLAN = 'ASTROLOGER_KUNDLI_YEARLY';
export const KUNDLI_INR_PRICE = 3500;
export const KUNDLI_YEAR_DAYS = 365;

// New checkouts stay closed until the payment-policy integration is approved.
// This does not suppress callbacks/reconciliation for already captured orders.
export function assertKundliCheckoutAvailable(planName: string): void {
  if (
    planName === KUNDLI_YEARLY_PLAN &&
    process.env.KUNDLI_SUBSCRIPTION_CHECKOUT_ENABLED !== 'true'
  ) {
    throw new ServiceUnavailableException({
      code: 'KUNDLI_CHECKOUT_DISABLED',
      message: 'Professional Kundli checkout is not yet activated.',
    });
  }
}

// Applied to new checkout/configuration only, never historical captured orders.
export function assertKundliPlan(plan: {
  name: string;
  price: Prisma.Decimal | number | string;
  currency: string;
  durationDays: number;
}): void {
  if (plan.name !== KUNDLI_YEARLY_PLAN) return;
  if (
    !new Prisma.Decimal(plan.price).equals(KUNDLI_INR_PRICE) ||
    plan.currency !== 'INR' ||
    plan.durationDays !== KUNDLI_YEAR_DAYS
  ) {
    throw new ServiceUnavailableException(
      'Kundli yearly checkout requires INR 3500 for 365 days. Plan configuration must be corrected before purchase.',
    );
  }
}
