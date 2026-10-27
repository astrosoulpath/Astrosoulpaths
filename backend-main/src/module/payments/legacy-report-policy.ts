import { ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Standalone report pricing is a different product from the professional plan.
// No historical charge or generation endpoint is changed by this new-order gate.
export function legacyReportPrice(): Prisma.Decimal {
  const configured = process.env.KUNDLI_LEGACY_REPORT_PRICE_INR ?? '';
  if (process.env.KUNDLI_LEGACY_REPORT_CHECKOUT_APPROVED !== 'true' ||
      !/^\d+(?:\.\d{1,2})?$/.test(configured)) {
    throw new ServiceUnavailableException('Standalone report checkout requires approved server pricing');
  }
  const price = new Prisma.Decimal(configured);
  if (price.lt(1) || price.mul(100).gt(Number.MAX_SAFE_INTEGER)) {
    throw new ServiceUnavailableException('Standalone report checkout price is invalid');
  }
  return price;
}
