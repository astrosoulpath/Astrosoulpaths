import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Existing default only. Never overrides a persisted global setting.
export const DEFAULT_PLATFORM_COMMISSION_PERCENT = 30;

export function validateCommissionPercent(
  value: unknown,
): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100 ||
    new Prisma.Decimal(value).decimalPlaces() > 2
  ) {
    throw new BadRequestException(
      'Commission must be between 0 and 100 with at most two decimal places',
    );
  }
}
