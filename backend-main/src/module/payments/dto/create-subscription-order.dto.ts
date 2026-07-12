import { IsIn, IsString } from 'class-validator';

export const PAYMENT_SUBSCRIPTION_PLAN_NAMES = [
  'DAILY_HOROSCOPE_MONTHLY',
  'ASTROLOGER_KUNDLI_YEARLY',
] as const;

export type PaymentSubscriptionPlanName =
  (typeof PAYMENT_SUBSCRIPTION_PLAN_NAMES)[number];

export class CreateSubscriptionOrderDto {
  @IsString()
  @IsIn(PAYMENT_SUBSCRIPTION_PLAN_NAMES, {
    message:
      'Plan must be DAILY_HOROSCOPE_MONTHLY or ASTROLOGER_KUNDLI_YEARLY',
  })
  planName!: PaymentSubscriptionPlanName;
}