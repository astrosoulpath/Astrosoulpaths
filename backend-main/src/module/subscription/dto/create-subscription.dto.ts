import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export const SUBSCRIPTION_PLAN_NAMES = [
  'DAILY_HOROSCOPE_MONTHLY',
  'ASTROLOGER_KUNDLI_YEARLY',
] as const;

export type SubscriptionPlanName =
  (typeof SUBSCRIPTION_PLAN_NAMES)[number];

export class CreateSubscriptionDto {
  @IsString()
  @IsIn(SUBSCRIPTION_PLAN_NAMES, {
    message:
      'Plan must be DAILY_HOROSCOPE_MONTHLY or ASTROLOGER_KUNDLI_YEARLY',
  })
  planName!: SubscriptionPlanName;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean = true;
}